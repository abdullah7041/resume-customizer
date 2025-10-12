export const GlobalWorkerOptions = {};

export const getDocument = () => ({
  promise: Promise.resolve({
    numPages: 0,
    getPage: async () => ({
      getTextContent: async () => ({ items: [] }),
      cleanup: () => {},
    }),
    cleanup: () => {},
    destroy: () => {},
  }),
});
