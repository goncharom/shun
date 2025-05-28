import { stringify } from "yaml";
import browser from "webextension-polyfill";

(() => {
  type NodeData = {
    type: string;
    content?: string;
    children?: NodeData[];
    name?: string;
  };

  const EXCLUDE_TAGS = [
    "script",
    "style",
    "link",
    "template",
    "iframe",
    "svg",
    "object",
    "embed",
    "noscript",
    "img",
    "input",
    "button",
    "menu",
    "menuitem",
    "menubar",
    "form",
    "dialog",
    "nav",
    "search",
    "combobox",
    "select",
    "option",
    "datalist",
  ];

  const EXCLUDE_ROLES = [
    "menu",
    "menuitem",
    "menubar",
    "button",
    "dialog",
    "alertdialog",
    "toolbar",
    "tooltip",
    "tab",
    "tablist",
    "tabpanel",
    "search",
    "searchbox",
    "presentation",
    "none",
  ];

  const shouldExclude = (el: Element): boolean => {
    const tag = el.tagName.toLowerCase();
    if (EXCLUDE_TAGS.includes(tag)) return true;

    const role = el.getAttribute("role");
    if (role && EXCLUDE_ROLES.includes(role)) return true;

    if (el.matches('[role="presentation"]:empty')) return true;

    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return true;

    return false;
  };

  const CLEANUP: string = EXCLUDE_TAGS.join(",");

  browser.runtime.onMessage.addListener((message: any) => {
    if (message.action !== "takeSnapshot") return;

    const root = document.querySelector('[role="main"], main, body');
    if (!root) return;
    const clone = root.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(CLEANUP).forEach((el: Element) => el.remove());

    const norm = (s: string): string => s.replace(/\s+/g, " ").trim();

    const childrenOf = (el: Element): Node[] =>
      el instanceof HTMLSlotElement
        ? (el.assignedNodes() as Node[])
        : [...el.childNodes, ...(el.shadowRoot?.childNodes || [])];

    const nodes: NodeData[] = [];
    const walk = (node: Node, parentNodes: NodeData[] = nodes): void => {
      let textContent = "";

      for (const n of childrenOf(node as Element)) {
        if (n.nodeType === Node.TEXT_NODE) {
          textContent += n.nodeValue || "";
          continue;
        }

        const normalizedText = norm(textContent);
        if (normalizedText) {
          parentNodes.push({ type: "text", content: normalizedText });
        }
        textContent = "";

        if (n.nodeType !== Node.ELEMENT_NODE) continue;
        const el = n as Element;

        if (shouldExclude(el)) continue;

        const tag = el.tagName.toLowerCase();

        if (tag === "code") {
          const txt = el.textContent || "";
          parentNodes.push({ type: "code", content: txt });
          continue;
        }

        if (
          ["div", "article", "section", "main"].includes(tag) &&
          !el.hasAttribute("role")
        ) {
          walk(el, parentNodes);
          continue;
        }

        const role = el.getAttribute("role") || tag;
        const name =
          el.getAttribute("aria-label") ||
          el.getAttribute("title") ||
          (el.childElementCount === 0 ? norm(el.textContent || "") : "");

        const children = childrenOf(el);
        if (children.length) {
          const nodeData: NodeData = { type: role };
          if (name) nodeData.name = name;
          nodeData.children = [];
          parentNodes.push(nodeData);
          walk(el, nodeData.children);
        } else {
          const nodeData: NodeData = { type: role };
          if (name) nodeData.name = name;
          parentNodes.push(nodeData);
        }
      }

      const normalizedText = norm(textContent);
      if (normalizedText) {
        parentNodes.push({ type: "text", content: normalizedText });
      }
    };

    const headerData = {
      url: location.href,
      title: document.title,
      access_date: new Date().toISOString(),
      current_date: new Date().toISOString(),
    };

    walk(clone);

    const yamlDoc = stringify({
      ...headerData,
      content: nodes,
    });

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(yamlDoc).catch(() => fallback());
    } else {
      fallback();
    }

    function fallback(): void {
      const ta = document.createElement("textarea");
      ta.value = yamlDoc;
      ta.style.position = "fixed";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  });
})();
