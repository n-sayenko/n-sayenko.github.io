import { Flex, Link, Text } from "@radix-ui/themes";

const INTERNAL = [
  { href: "/", label: "home", key: "home" },
  { href: "/art/", label: "art", key: "art" },
  { href: "/projects/", label: "projects", key: "projects" },
];

const EXTERNAL = [
  { href: "https://github.com/n-sayenko", label: "github" },
  {
    href: "https://www.linkedin.com/in/nataliya-sayenko-4289b7192/",
    label: "linkedin",
  },
  { href: "mailto:nataliyasayenko@gmail.com", label: "email" },
];

export default function Nav({ current }) {
  return (
    <Flex asChild justify="center" align="center" gap="4" wrap="wrap" my="5">
      <nav aria-label="Main">
        {INTERNAL.map((item) => {
          const isCurrent = item.key === current;
          return (
            <Link
              key={item.key}
              href={item.href}
              size="2"
              color="blue"
              weight="bold"
              /* the current page is the one dark, boxed link; the rest stay
                 plain blue so "where am I" reads at a glance */
              highContrast={isCurrent}
              underline="none"
              className={isCurrent ? "nav-link nav-link-current" : "nav-link"}
              aria-current={isCurrent ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}

        <Text size="2" color="gray" aria-hidden="true">
          ·
        </Text>

        {EXTERNAL.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            size="2"
            color="blue"
            weight="bold"
            underline="hover"
            {...(item.href.startsWith("http")
              ? { target: "_blank", rel: "noreferrer" }
              : {})}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </Flex>
  );
}
