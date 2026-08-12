const allowedTags = new Set([
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'BLOCKQUOTE',
  'P',
  'UL',
  'OL',
  'LI',
  'NL',
  'B',
  'I',
  'STRONG',
  'EM',
  'STRIKE',
  'CODE',
  'HR',
  'BR',
  'DIV',
  'CAPTION',
  'PRE',
]);

const removeUnsafeNodes = (parent) => {
  Array.from(parent.children).forEach((element) => {
    if (!allowedTags.has(element.tagName)) {
      if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') {
        element.remove();

        return;
      }

      element.replaceWith(document.createTextNode(element.textContent || ''));

      return;
    }

    Array.from(element.attributes).forEach((attribute) => {
      element.removeAttribute(attribute.name);
    });

    removeUnsafeNodes(element);
  });
};

export const sanitizeHtml = (html) => {
  const template = document.createElement('template');

  template.innerHTML = typeof html === 'string' ? html : '';
  removeUnsafeNodes(template.content);

  return template.innerHTML;
};
