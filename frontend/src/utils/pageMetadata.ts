type PageMetadata = {
  title: string;
  description: string;
  canonicalUrl: string;
  robots?: string;
};

type AttributeSnapshot = {
  element: HTMLElement;
  attribute: string;
  previousValue: string | null;
  created: boolean;
};

function updateElementAttribute(
  selector: string,
  tagName: 'meta' | 'link',
  identityAttribute: 'name' | 'property' | 'rel',
  identityValue: string,
  valueAttribute: 'content' | 'href',
  value: string,
): AttributeSnapshot {
  let element = document.querySelector<HTMLElement>(selector);
  const created = !element;
  if (!element) {
    element = document.createElement(tagName);
    element.setAttribute(identityAttribute, identityValue);
    document.head.appendChild(element);
  }
  const previousValue = element.getAttribute(valueAttribute);
  element.setAttribute(valueAttribute, value);
  return {
    element,
    attribute: valueAttribute,
    previousValue,
    created,
  };
}

export function applyPageMetadata({
  title,
  description,
  canonicalUrl,
  robots = 'noindex, nofollow',
}: PageMetadata) {
  const previousTitle = document.title;
  document.title = title;

  const snapshots = [
    updateElementAttribute(
      'meta[name="description"]',
      'meta',
      'name',
      'description',
      'content',
      description,
    ),
    updateElementAttribute(
      'meta[name="robots"]',
      'meta',
      'name',
      'robots',
      'content',
      robots,
    ),
    updateElementAttribute(
      'meta[property="og:title"]',
      'meta',
      'property',
      'og:title',
      'content',
      title,
    ),
    updateElementAttribute(
      'meta[property="og:description"]',
      'meta',
      'property',
      'og:description',
      'content',
      description,
    ),
    updateElementAttribute(
      'meta[property="og:url"]',
      'meta',
      'property',
      'og:url',
      'content',
      canonicalUrl,
    ),
    updateElementAttribute(
      'meta[name="twitter:title"]',
      'meta',
      'name',
      'twitter:title',
      'content',
      title,
    ),
    updateElementAttribute(
      'meta[name="twitter:description"]',
      'meta',
      'name',
      'twitter:description',
      'content',
      description,
    ),
    updateElementAttribute(
      'link[rel="canonical"]',
      'link',
      'rel',
      'canonical',
      'href',
      canonicalUrl,
    ),
  ];

  return () => {
    document.title = previousTitle;
    for (const snapshot of snapshots) {
      if (snapshot.created) {
        snapshot.element.remove();
      } else if (snapshot.previousValue === null) {
        snapshot.element.removeAttribute(snapshot.attribute);
      } else {
        snapshot.element.setAttribute(snapshot.attribute, snapshot.previousValue);
      }
    }
  };
}
