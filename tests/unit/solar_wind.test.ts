import test from 'node:test';
import assert from 'node:assert/strict';
import {
    applySailForces,
    createSailRideState,
    sailRideMultiplier,
    sailFieldForce,
    sailWindAngle,
    effectiveSailMultiplier,
    SAIL_RIDE_BASE_MULT,
    SAIL_RIDE_MAX_MULT,
    SAIL_RIDE_SECONDS,
    SAIL_MAX_VERTICAL_ACCEL,
    SAIL_UNFOLD_ACTIVE
} from '../../src/solar_wind.ts';

const LIMITS = { maxSpeedY: 18, maxDescentSpeed: 22 };
const DT = 1 / 60;

test('ride multiplier: 1.25× base, +0.15× per extra sail, capped at 1.8×', () => {
    assert.equal(sailRideMultiplier(0), 1);
    assert.equal(sailRideMultiplier(1), SAIL_RIDE_BASE_MULT);
    assert.ok(Math.abs(sailRideMultiplier(2) - 1.4) < 1e-9);
    assert.ok(Math.abs(sailRideMultiplier(4) - 1.7) < 1e-9);
    assert.equal(sailRideMultiplier(5), SAIL_RIDE_MAX_MULT);
    assert.equal(sailRideMultiplier(12), SAIL_RIDE_MAX_MULT);
});

test('two overlapping ferns vector-sum into currentSpeedY and a bigger scroll ride than one', () => {
    const up = { x: 10, y: 4 };
    const upToo = { x: 9, y: 3 };

    const one = applySailForces([up], DT, createSailRideState(), 0, LIMITS);
    const two = applySailForces([up, upToo], DT, createSailRideState(), 0, LIMITS);

    assert.ok(Math.abs(one.currentSpeedY - 4 * DT) < 1e-9);
    assert.ok(Math.abs(two.currentSpeedY - 7 * DT) < 1e-9, 'vertical accel sums');
    assert.equal(one.scrollMultiplier, SAIL_RIDE_BASE_MULT);
    assert.ok(Math.abs(two.scrollMultiplier - 1.4) < 1e-9);
    assert.equal(two.activeSails, 2);
});

test('opposing vertical fields cancel', () => {
    const r = applySailForces([{ x: 8, y: 5 }, { x: 8, y: -5 }], DT, createSailRideState(), 2, LIMITS);
    assert.ok(Math.abs(r.currentSpeedY - 2) < 1e-9);
});

test('12 stacked ferns cannot launch the ship: vertical accel and speed are capped', () => {
    const forces = Array.from({ length: 12 }, () => ({ x: 10, y: 14 }));
    const r = applySailForces(forces, DT, createSailRideState(), 0, LIMITS);
    assert.ok(Math.abs(r.currentSpeedY - SAIL_MAX_VERTICAL_ACCEL * DT) < 1e-9);
    assert.equal(r.scrollMultiplier, SAIL_RIDE_MAX_MULT);

    // Held in the lane for a long time, speed still clamps to the flight model.
    let ride = createSailRideState();
    let vy = 0;
    for (let i = 0; i < 600; i++) {
        const s = applySailForces(forces, DT, ride, vy, LIMITS);
        ride = s.ride;
        vy = s.currentSpeedY;
    }
    assert.equal(vy, LIMITS.maxSpeedY);
});

test('ride lingers for 5 s after the last field, fades over the final second, then ends', () => {
    let ride = applySailForces([{ x: 10, y: 0 }], DT, createSailRideState(), 0, LIMITS).ride;
    assert.equal(ride.timer, SAIL_RIDE_SECONDS);

    const steps = Math.round(SAIL_RIDE_SECONDS / DT);
    let mid = 0;
    let fading = 0;
    for (let i = 0; i < steps; i++) {
        const r = applySailForces([], DT, ride, 0, LIMITS);
        ride = r.ride;
        if (i === Math.round(2 / DT)) mid = r.scrollMultiplier;
        if (i === steps - Math.round(0.5 / DT)) fading = r.scrollMultiplier;
    }
    assert.equal(mid, SAIL_RIDE_BASE_MULT, 'full buff mid-ride');
    assert.ok(fading > 1 && fading < SAIL_RIDE_BASE_MULT, `fading (${fading})`);
    assert.equal(effectiveSailMultiplier(ride), 1);
    assert.deepEqual(ride, createSailRideState());
});

test('drifting from 3 overlapping sails into 1 keeps the earned multiplier', () => {
    const three = applySailForces(
        [{ x: 10, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }], DT, createSailRideState(), 0, LIMITS
    );
    const one = applySailForces([{ x: 10, y: 0 }], DT, three.ride, 0, LIMITS);
    assert.ok(Math.abs(one.scrollMultiplier - 1.55) < 1e-9);
});

test('folded ferns project no field; open field falls off to the edge', () => {
    assert.equal(sailFieldForce(0, SAIL_UNFOLD_ACTIVE - 0.01, 1, 14), null);
    assert.equal(sailFieldForce(0, 1, 14, 14), null);
    const centre = sailFieldForce(0, 1, 0, 14)!;
    const edge = sailFieldForce(0, 1, 10, 14)!;
    assert.ok(centre.x > edge.x && edge.x > 0);
    assert.ok(Math.abs(centre.y) < 1e-9);
    const tilted = sailFieldForce(0.4, 1, 0, 14)!;
    assert.ok(tilted.y > 0 && tilted.x > 0);
});

test('blade facing is deterministic, forward-leaning, and draws no RNG', () => {
    const a = sailWindAngle(1234.5, 6.25);
    assert.equal(a, sailWindAngle(1234.5, 6.25));
    for (let i = 0; i < 200; i++) {
        const ang = sailWindAngle(i * 37.1, (i % 17) - 8);
        assert.ok(Math.abs(ang) <= 0.55 + 1e-12);
        assert.ok(Math.cos(ang) > 0.85);
    }
});

test('no wind never touches currentSpeedY, even above the flight limits', () => {
    const over = applySailForces([], DT, createSailRideState(), 30, LIMITS);
    assert.equal(over.currentSpeedY, 30);
    const under = applySailForces([], DT, createSailRideState(), -40, LIMITS);
    assert.equal(under.currentSpeedY, -40);
    // Upward wind on an over-limit climb does not pull it back down either.
    const pushed = applySailForces([{ x: 10, y: 5 }], DT, createSailRideState(), 30, LIMITS);
    assert.equal(pushed.currentSpeedY, 30);
});
