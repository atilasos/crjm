"""Testes da coordenação multiprocessing do self-play (sem GPU)."""

from __future__ import annotations

import multiprocessing as mp
import time
import unittest

from atari_go.selfplay import _collect_worker_parts, _start_processes


def _successful_worker(queue) -> None:
    queue.put({"ok": True, "pid": 1, "payload": {"value": 42}})


def _crashing_worker(_queue) -> None:
    raise RuntimeError("falha intencional")


def _reported_failure_worker(queue) -> None:
    queue.put({
        "ok": False,
        "pid": 2,
        "error": "RuntimeError: falha reportada",
        "traceback": "traceback de teste",
    })
    raise RuntimeError("falha reportada")


def _hung_worker(_queue) -> None:
    time.sleep(60)


def _result_then_hang_worker(queue) -> None:
    queue.put({"ok": True, "pid": 3, "payload": {"value": 7}})
    queue.close()
    queue.join_thread()  # garante que o envelope chega antes de simular o hang
    time.sleep(60)


class _FakeProcess:
    def __init__(self, fail_start: bool = False) -> None:
        self.fail_start = fail_start
        self.started = False
        self.terminated = False
        self.pid = 123
        self.exitcode = None

    def start(self) -> None:
        if self.fail_start:
            raise RuntimeError("start falhou")
        self.started = True

    def join(self, timeout=None) -> None:
        del timeout

    def is_alive(self) -> bool:
        return self.started and not self.terminated

    def terminate(self) -> None:
        self.terminated = True
        self.exitcode = -15

    def kill(self) -> None:
        self.terminated = True
        self.exitcode = -9


class WorkerCollectionTest(unittest.TestCase):
    def setUp(self) -> None:
        self.ctx = mp.get_context("spawn")

    def test_cleans_started_workers_when_later_start_fails(self) -> None:
        first = _FakeProcess()
        second = _FakeProcess(fail_start=True)
        with self.assertRaisesRegex(RuntimeError, "start falhou"):
            _start_processes([first, second])  # type: ignore[arg-type]
        self.assertTrue(first.terminated)

    def test_collects_successful_payload(self) -> None:
        queue = self.ctx.Queue()
        proc = self.ctx.Process(target=_successful_worker, args=(queue,))
        proc.start()
        self.assertEqual(_collect_worker_parts([proc], queue, "teste"), [{"value": 42}])

    def test_detects_worker_that_dies_without_queue_result(self) -> None:
        queue = self.ctx.Queue()
        proc = self.ctx.Process(target=_crashing_worker, args=(queue,))
        proc.start()
        with self.assertRaisesRegex(RuntimeError, "worker terminou sem resultado"):
            _collect_worker_parts([proc], queue, "teste")

    def test_surfaces_reported_worker_error(self) -> None:
        queue = self.ctx.Queue()
        proc = self.ctx.Process(target=_reported_failure_worker, args=(queue,))
        proc.start()
        with self.assertRaisesRegex(RuntimeError, "falha reportada"):
            _collect_worker_parts([proc], queue, "teste")

    def test_times_out_live_worker_without_progress(self) -> None:
        queue = self.ctx.Queue()
        proc = self.ctx.Process(target=_hung_worker, args=(queue,))
        proc.start()
        with self.assertRaisesRegex(RuntimeError, "sem progresso"):
            _collect_worker_parts([proc], queue, "teste", stall_timeout_s=0.2)
        self.assertFalse(proc.is_alive())

    def test_terminates_worker_that_hangs_after_result(self) -> None:
        queue = self.ctx.Queue()
        proc = self.ctx.Process(target=_result_then_hang_worker, args=(queue,))
        proc.start()
        with self.assertRaisesRegex(RuntimeError, "após enviar resultado"):
            _collect_worker_parts([proc], queue, "teste", stall_timeout_s=3)
        self.assertFalse(proc.is_alive())


if __name__ == "__main__":
    unittest.main()
