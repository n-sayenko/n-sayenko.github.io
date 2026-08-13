import { Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import "../styles.css";

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
