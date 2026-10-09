import { assessSummary, combineSummaries } from './summary-quality.js';
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
        `Summarize the following text in one or two sentences:\n\n${chunks[i]}`,
        {
          max_new_tokens: 80,
          do_sample: false,
          num_beams: 1,
          repetition_penalty: 1.15,
          no_repeat_ngram_size: 3,
        },
      );
      const checked = assessSummary(result[0]?.generated_text || '', chunks[i]);
      if (!checked.ok) {
        self.postMessage({
          type: 'quality-failure',
          requestId: data.requestId,
          reason: checked.reason,
        });
        return;
      }
      summaries.push(checked.text);
    }
    if (!summaries.length) {
      self.postMessage({
        type: 'quality-failure',
        requestId: data.requestId,
        reason: 'No chunk passed check',
      });
      return;
    }
    const overview = combineSummaries(summaries, data.text || chunks.join('\n'));
    if (!overview.ok) {
      self.postMessage({
        type: 'quality-failure',
        requestId: data.requestId,
        reason: overview.reason,
      });
      return;
    }
    self.postMessage({
      type: 'result',
      requestId: data.requestId,
      text: overview.text,
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
