import { ref } from 'vue';
import type { ModuleContext } from '../../contracts/operations';
import { mediaWorkspaceKey } from '../../contracts/customer';
import type { MediaFile } from '../../contracts/customer';
export function activate(context: ModuleContext): () => void {
  const urls = new Set<string>();
  const files = ref<readonly MediaFile[]>([]);
  context.provide(mediaWorkspaceKey, {
    files,
    add(file) {
      if (file.url.startsWith('blob:')) urls.add(file.url);
      files.value = [file, ...files.value];
    },
  });
  return () => {
    for (const url of urls) URL.revokeObjectURL(url);
  };
}
