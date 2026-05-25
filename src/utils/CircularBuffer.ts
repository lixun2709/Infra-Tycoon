/**
 * CircularBuffer
 * A high-performance, zero-allocation ring buffer backed by a contiguous Float32Array.
 * Replaces O(N) Array.shift() operations with O(1) index-wrapping arithmetic.
 * Ensures memory layout remains cache-friendly and worker-thread serializable.
 */
export class CircularBuffer {
  public readonly buffer: Float32Array
  private _head: number = 0
  private _size: number = 0
  private readonly _capacity: number

  constructor(capacity: number) {
    this._capacity = capacity
    this.buffer = new Float32Array(capacity)
  }

  /**
   * Pushes a new value into the buffer in O(1) time.
   */
  public push(value: number): void {
    this.buffer[this._head] = value
    this._head = (this._head + 1) % this._capacity
    if (this._size < this._capacity) {
      this._size++
    }
  }

  /**
   * Retrieves the most recently added value.
   */
  public last(): number | undefined {
    if (this._size === 0) return undefined
    // Head points to the next insertion index, so the last element is immediately behind it
    const lastIndex = (this._head - 1 + this._capacity) % this._capacity
    return this.buffer[lastIndex]
  }

  /**
   * The current number of populated elements.
   */
  public get length(): number {
    return this._size
  }

  /**
   * Extracts the items in chronological order (oldest to newest).
   * Note: This allocates a new array. Only use when actively parsing the full history.
   */
  public toArray(): number[] {
    const result = new Array(this._size)
    if (this._size === 0) return result

    // If buffer isn't full, read from 0 to head
    if (this._size < this._capacity) {
      for (let i = 0; i < this._size; i++) {
        result[i] = this.buffer[i]
      }
    } else {
      // Buffer is full, head is the oldest element
      for (let i = 0; i < this._size; i++) {
        result[i] = this.buffer[(this._head + i) % this._capacity]
      }
    }
    return result
  }
}
