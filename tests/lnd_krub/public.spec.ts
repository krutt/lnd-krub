// ~~/tests/lndkrub/public.spec.ts

// imports
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import lndkrub from '@/index'
import supertest from 'supertest'

afterAll(() => {
  lndkrub.emit('event:shutdown')
})

beforeAll(() => {
  lndkrub.emit('event:startup')
})

// public routes
// ...