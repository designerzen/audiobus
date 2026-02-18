import { describe, it, expect } from 'vitest'
import { Transformer } from '../abstract-transformer.ts'
import { IdentityTransformer } from '../transformer-identity.ts'
import { TransformerQuantise } from '../transformer-quantise.ts'
import { TransformerTransposer } from '../transformer-transposer.ts'
import { TransformerArpeggiator } from '../transformer-arpeggiator.ts'
import { TransformerRandomiser } from '../transformer-randomiser.ts'
import { TUNING_MODE_IONIAN } from '../../tuning/scales.ts'

describe('All Transformers', () => {
    it('should all implement ITransformer', () => {
        const transformers = [
            new IdentityTransformer({}),
            new TransformerQuantise({ step: 4 }),
            new TransformerTransposer({ root: 0, mode: TUNING_MODE_IONIAN }),
            new TransformerArpeggiator({
                enabled: true,
                pattern: 'up',
                rate: '1/16',
                octaves: 1
            }),
            new TransformerRandomiser({
                uncertainty: 50,
                offset: 12
            })
        ]

        transformers.forEach(transformer => {
            // Check required properties
            expect(transformer).toHaveProperty('id')
            expect(transformer).toHaveProperty('fields')
            expect(transformer).toHaveProperty('options')
            expect(transformer).toHaveProperty('name')
            
            // Check required methods
            expect(typeof transformer.transform).toBe('function')
            expect(typeof transformer.reset).toBe('function')
            expect(typeof transformer.setConfig).toBe('function')
        })
    })

    it('should generate unique IDs for transformers', () => {
        const transformer1 = new IdentityTransformer({})
        const transformer2 = new IdentityTransformer({})

        expect(transformer1.id).not.toBe(transformer2.id)
    })

    it('should have descriptive names', () => {
        const transformers = [
            { t: new IdentityTransformer({}), expectedName: 'Identity Transformer' },
            { t: new TransformerQuantise({ step: 4 }), expectedName: 'Quantiser' },
            { t: new TransformerTransposer({ root: 0, mode: TUNING_MODE_IONIAN }), expectedName: 'Transposer' },
            { t: new TransformerArpeggiator({
                enabled: true,
                pattern: 'up',
                rate: '1/16',
                octaves: 1
            }), expectedName: 'Arpeggiator' },
            { t: new TransformerRandomiser({
                uncertainty: 50,
                offset: 12
            }), expectedName: 'Randomiser' }
        ]

        transformers.forEach(({ t, expectedName }) => {
            expect(t.name).toBe(expectedName)
        })
    })

    it('should allow configuration updates', () => {
        const transformer = new TransformerQuantise({ step: 4 })
        
        transformer.setConfig('step', 8)
        expect(transformer.options.step).toBe(8)
        
        transformer.setConfig('step', 16)
        expect(transformer.options.step).toBe(16)
    })

    it('should provide configuration fields', () => {
        const transformers = [
            new IdentityTransformer({}),
            new TransformerQuantise({ step: 4 }),
            new TransformerTransposer({ root: 0, mode: TUNING_MODE_IONIAN }),
            new TransformerArpeggiator({
                enabled: true,
                pattern: 'up',
                rate: '1/16',
                octaves: 1
            }),
            new TransformerRandomiser({
                uncertainty: 50,
                offset: 12
            })
        ]

        transformers.forEach(transformer => {
            const fields = transformer.fields
            expect(Array.isArray(fields)).toBe(true)
            
            // Most transformers should have fields
            if (fields.length > 0) {
                fields.forEach(field => {
                    expect(field).toHaveProperty('name')
                    expect(field).toHaveProperty('type')
                    expect(field).toHaveProperty('values')
                })
            }
        })
    })

    it('should support reset', () => {
        const transformers = [
            new IdentityTransformer({}),
            new TransformerQuantise({ step: 4 }),
            new TransformerTransposer({ root: 0, mode: TUNING_MODE_IONIAN }),
            new TransformerArpeggiator({
                enabled: true,
                pattern: 'up',
                rate: '1/16',
                octaves: 1
            }),
            new TransformerRandomiser({
                uncertainty: 50,
                offset: 12
            })
        ]

        transformers.forEach(transformer => {
            // Should not throw
            expect(() => transformer.reset()).not.toThrow()
        })
    })
})
