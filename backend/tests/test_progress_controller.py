"""Tests for progress_controller module."""

from __future__ import annotations

import asyncio

import pytest  # type: ignore[import-untyped]

from progress_controller import Aborted, ProgressController


def test_progress_controller_initial_state():
    """Test that ProgressController starts in correct state."""
    controller = ProgressController()
    assert not controller.paused
    assert not controller.aborted
    assert controller.time_paused == 0


def test_progress_controller_pause():
    """Test pausing the controller."""
    controller = ProgressController()
    controller.pause()
    assert controller.paused
    assert not controller.aborted


def test_progress_controller_resume():
    """Test resuming the controller."""
    controller = ProgressController()
    controller.pause()
    controller.resume()
    assert not controller.paused
    assert not controller.aborted


def test_progress_controller_abort():
    """Test aborting the controller."""
    controller = ProgressController()
    controller.abort()
    assert controller.aborted


@pytest.mark.asyncio
async def test_suspend_not_paused_or_aborted():
    """Test suspend completes immediately when not paused or aborted."""
    controller = ProgressController()
    # Should complete without raising exception
    await controller.suspend()
    assert controller.time_paused == 0


@pytest.mark.asyncio
async def test_suspend_when_aborted():
    """Test suspend raises Aborted when controller is aborted."""
    controller = ProgressController()
    controller.abort()

    with pytest.raises(Aborted):
        await controller.suspend()


@pytest.mark.asyncio
async def test_suspend_when_paused_then_resumed():
    """Test suspend waits when paused, then continues when resumed."""
    controller = ProgressController()
    controller.pause()

    async def resume_after_delay():
        await asyncio.sleep(0.2)
        controller.resume()

    # Start the resume task
    resume_task = asyncio.create_task(resume_after_delay())

    # This should block until resumed
    await controller.suspend()

    # Clean up
    await resume_task

    # Should have tracked some paused time
    assert controller.time_paused > 0
    assert not controller.paused


@pytest.mark.asyncio
async def test_suspend_when_paused_then_aborted():
    """Test suspend raises Aborted when paused and then aborted."""
    controller = ProgressController()
    controller.pause()

    async def abort_after_delay():
        await asyncio.sleep(0.2)
        controller.abort()

    # Start the abort task
    abort_task = asyncio.create_task(abort_after_delay())

    # This should block until aborted
    with pytest.raises(Aborted):
        await controller.suspend()

    # Clean up
    await abort_task

    # Should have tracked some paused time
    assert controller.time_paused > 0


@pytest.mark.asyncio
async def test_suspend_accumulates_time_paused():
    """Test that time_paused accumulates across multiple suspend calls."""
    controller = ProgressController()

    # First pause and resume
    controller.pause()

    async def resume_after_delay():
        await asyncio.sleep(0.15)
        controller.resume()

    resume_task = asyncio.create_task(resume_after_delay())
    await controller.suspend()
    await resume_task

    first_time = controller.time_paused
    assert first_time > 0

    # Second pause and resume
    controller.pause()

    async def resume_again():
        await asyncio.sleep(0.15)
        controller.resume()

    resume_task2 = asyncio.create_task(resume_again())
    await controller.suspend()
    await resume_task2

    # Time should have accumulated
    assert controller.time_paused > first_time


@pytest.mark.asyncio
async def test_multiple_pauses_and_resumes():
    """Test multiple pause/resume cycles."""
    controller = ProgressController()

    for _ in range(3):
        assert not controller.paused
        controller.pause()
        assert controller.paused
        controller.resume()
        assert not controller.paused


def test_abort_while_paused():
    """Test that abort can be called while paused."""
    controller = ProgressController()
    controller.pause()
    controller.abort()

    assert controller.paused  # Still marked as paused
    assert controller.aborted  # But also aborted
