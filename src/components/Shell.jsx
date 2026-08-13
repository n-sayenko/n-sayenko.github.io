import { Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import "../styles.css";

// appearance is pinned to light on purpose: the portrait is dithered to
// 1-bit black-on-white and its dark pixels disappear against a dark ground.
export default function Shell({ children }) {
  return (
    <Theme
      appearance="light"
      accentColor="gray"
      grayColor="sand"
      radius="none"
      scaling="100%"
      panelBackground="solid"
    >
      {children}
    </Theme>
  );
}
