let summarizer;
let loading;
const MODEL = 'Xenova/flan-t5-small';
self.onmessage = async ({ data }) => {
  try {
    if (!loading)
      loading = (async () => {
        const { pipeline, env } = await import(
          'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0'
        );
        env.allowLocalModels = false;
        env.useBrowserCache = true;
        env.backends.onnx.wasm.numThreads = 1;
        const files = new Map();
        summarizer = await pipeline('text2text-generation', MODEL, {
          dtype: 'q8',
          device: 'wasm',
          progress_callback(event) {
            if (event.status === 'progress')
              files.set(event.file, { loaded: event.loaded || 0, total: event.total || 0 });
            const values = [...files.values()];
            const total = values.reduce((sum, file) => sum + file.total, 0);
            const loaded = values.reduce((sum, file) => sum + file.loaded, 0);
            self.postMessage({
              type: 'progress',
              status: event.status,
              file: event.file,
              progress: total ? (100 * loaded) / total : 0,
              loaded,
              total,
            });
          },
        });
      })();
    await loading;
    const chunks = data.chunks?.length ? data.chunks : [data.text];
    const summaries = [];
    for (let i = 0; i < chunks.length; i++) {
      self.postMessage({
        type: 'running',
        requestId: data.requestId,
        section: i + 1,
        sections: chunks.length,
      });
      const result = await summarizer(
        `Summarize this group conversation, including the main decisions and important updates:\n${chunks[i]}\nSummary:`,
        {
          max_new_tokens: 100,
          min_new_tokens: 12,
          do_sample: false,
          num_beams: 1,
          repetition_penalty: 1.15,
        },
      );
      if (result[0]?.generated_text?.trim()) summaries.push(result[0].generated_text.trim());
    }
    if (!summaries.length) throw new Error('Local model did not generate a summary.');
    self.postMessage({
      type: 'result',
      requestId: data.requestId,
      text: summaries.join('\n\n'),
      model: MODEL,
    });
  } catch (error) {
    loading = null;
    summarizer = null;
    self.postMessage({
      type: 'error',
      requestId: data.requestId,
      message: error.message || String(error),
    });
  }
};
