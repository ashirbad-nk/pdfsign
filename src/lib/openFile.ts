import { openPdf } from './pdfEngine';
import { useAppStore } from './store';

export async function openPdfFile(file: File): Promise<void> {
  const store = useAppStore.getState();
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    store.showToast('Please choose a PDF file.', 'error');
    return;
  }
  store.setLoadingPdf(true);
  try {
    const meta = await openPdf(file);
    store.setPdf(meta);
    store.showToast(`Opened ${file.name}`, 'success');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not open that PDF.';
    store.showToast(message, 'error');
  } finally {
    store.setLoadingPdf(false);
  }
}
