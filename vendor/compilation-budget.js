// Keep shader preparation responsive without paying a scheduler round trip for
// every cached object or empty shader stage in a large world.
export function createCompilationBudget(yieldToMain, now = () => performance.now(), budgetMs = 8) {
  let deadline = now() + budgetMs;
  return async function yieldWhenDue() {
    if (now() < deadline) return;
    await yieldToMain();
    deadline = now() + budgetMs;
  };
}
