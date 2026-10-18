import '@testing-library/jest-dom/vitest';
import {cleanup} from '@testing-library/react';
import {afterEach} from 'vitest';

// With `globals: false` Vitest does not register Testing Library's automatic
// cleanup, so renders would accumulate in one document and queries such as
// getByRole('button') would match several elements. Unmounting explicitly is
// what makes these tests deterministic (TESTING.md section 3).
afterEach(cleanup);
