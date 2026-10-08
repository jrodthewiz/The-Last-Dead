// Node building stays serial: it shares renderer state. Independent native GPU
// pipeline promises may overlap, with a small cap to bound compiler memory.
export function createCompilationPipelineQueue(limit = 8) {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('Pipeline concurrency must be a positive integer');
  const pending = new Set();
  let failure;
  return {
    async submit(promises) {
      if (!promises.length) { if (failure) throw failure; return; }
      const job = Promise.allSettled(promises).then(results => {
        for (const result of results) if (result.status === 'rejected') failure ||= result.reason;
      }).finally(() => pending.delete(job));
      pending.add(job);
      // The caller has already submitted these GPU requests. Even after an
      // earlier failure, own their promises so finish() can drain them.
      if (failure) throw failure;
      if (pending.size >= limit) await Promise.race(pending);
      if (failure) throw failure;
    },
    async finish() {
      await Promise.all(pending);
      if (failure) throw failure;
    },
  };
}
