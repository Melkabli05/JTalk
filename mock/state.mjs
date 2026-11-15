// All the mock's data, in memory. `createState().reset()` puts the seed data back.
export function createState() {
  const state = {
    /** Failed sign-ins per address, for the lockout. */
    failedLogins: new Map(),
    reset() {
      state.failedLogins = new Map();
    },
  };
  state.reset();
  return state;
}
