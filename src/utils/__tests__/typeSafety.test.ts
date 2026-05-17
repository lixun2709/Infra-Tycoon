import { describe, it, expect } from 'vitest'
import { 
  success, 
  failure, 
  isSuccess, 
  isFailure, 
  type Result, 
  type DeepReadonly, 
  type DeepPartial 
} from '../typeSafety'

describe('TypeScript Safety Utilities', () => {
  describe('Functional Result Pattern', () => {
    it('should create a success result', () => {
      const res = success(42)
      expect(res.success).toBe(true)
      expect(res.value).toBe(42)
      expect(res.error).toBeUndefined()
    })

    it('should create a failure result', () => {
      const err = new Error('Test Failure')
      const res = failure(err)
      expect(res.success).toBe(false)
      expect(res.error).toBe(err)
      expect(res.value).toBeUndefined()
    })

    it('should narrow types successfully using isSuccess type guard', () => {
      const res: Result<string, Error> = success('narrowed')
      
      if (isSuccess(res)) {
        // Enforce that TypeScript compiles this property access safely
        const val: string = res.value
        expect(val).toBe('narrowed')
      } else {
        throw new Error('Should not be failure branch')
      }
    })

    it('should narrow types successfully using isFailure type guard', () => {
      const err = new Error('structured fail')
      const res: Result<string, Error> = failure(err)
      
      if (isFailure(res)) {
        // Enforce that TypeScript compiles this property access safely
        const errorObj: Error = res.error
        expect(errorObj.message).toBe('structured fail')
      } else {
        throw new Error('Should not be success branch')
      }
    })
  })

  describe('Compile-time Utility Type Structural Checks', () => {
    it('should allow reading but check assignment structural compliance for DeepReadonly', () => {
      interface Complex {
        a: number
        b: { c: string }
      }
      
      const orig: Complex = { a: 1, b: { c: 'hello' } }
      const frozen: DeepReadonly<Complex> = orig
      
      expect(frozen.a).toBe(1)
      expect(frozen.b.c).toBe('hello')
      
      // Explicit compile-time check: since frozen is DeepReadonly, type assignment checks out
      const readonlyCheck: { readonly a: number; readonly b: { readonly c: string } } = frozen
      expect(readonlyCheck.b.c).toBe('hello')
    })

    it('should allow structural lookup matching for DeepPartial properties', () => {
      interface Complex {
        a: number
        b: { c: string }
      }
      
      // DeepPartial means every nested property is optional
      const part: DeepPartial<Complex> = { b: {} }
      
      expect(part.a).toBeUndefined()
      expect(part.b?.c).toBeUndefined()
    })
  })
})
