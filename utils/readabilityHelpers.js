export function getMainText() {
    // Clone the document to avoid modifying the page
    const docClone = document.cloneNode(true);

    // Use Readability
    const article = new Readability(docClone).parse();

    if (!article) {
        console.warn("Could not extract main content.");
        return null;
    }

    // This is the plain main text (no navbars, footers, or headers)
    return article.textContent;
}
