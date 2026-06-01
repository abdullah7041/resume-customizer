export const emptyRagContextProvider = {
  async getContext() {
    return {
      documents: [],
      citations: [],
    };
  },
};

export function formatRagContext(context) {
  const documents = Array.isArray(context?.documents) ? context.documents : [];
  if (documents.length === 0) return '';

  return documents
    .map((doc, index) => {
      const title = doc?.title ? `title: ${doc.title}\n` : '';
      const source = doc?.source ? `source: ${doc.source}\n` : '';
      return `[${index + 1}]\n${title}${source}${doc?.content || ''}`;
    })
    .join('\n\n');
}
