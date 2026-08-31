import type { Node } from 'three/src/nodes/Nodes.js';

/**
 * Type for TSL shader-node values that are reassigned across node subtypes.
 *
 * TSL factory functions return narrow node types (e.g. `float(0.0)` returns
 * `ConstNode<number>`), while fluent operations return different subtypes
 * (e.g. `.add()` returns `OperatorNode`). Annotating accumulators as
 * `TSLNode` lets `let total = float(0.0)` be reassigned with
 * `total = total.add(...)` without fighting `three/tsl` inference.
 *
 * Prefer this over annotating as `ConstNode`/`MathNode`/`OperatorNode`.
 */
export type TSLNode = Node;

/**
 * A `uniform()` node whose `.value` is a concrete JS/Three type.
 *
 * `uniform()` infers `.value` as `unknown` for object payloads, so
 * `uPlayerPos.value.copy(pos)` fails under `strict`. Annotating the field as
 * `TSLUniform<THREE.Vector3>` keeps the node usable in TSL expressions while
 * typing the CPU-side write. Prefer this over `uPlayerPos: any`.
 */
export type TSLUniform<T> = Node & { value: T };
