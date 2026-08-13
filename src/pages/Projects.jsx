import { Badge, Container, Flex, Heading, Link, Text } from "@radix-ui/themes";
import Nav from "../components/Nav";

const PROJECTS = [
  {
    title: "ripe fruit",
    blurb:
      "A foraging map of fruit trees in Seattle",
    href: "https://www.ripefruit.app/",
  },
  {
    title: "museum store",
    blurb:
      "coming soon",
    href: null,
  },
];

export default function Projects() {
  return (
    <Container size="2" px="4" py="6">
      <Nav current="projects" />

      <Flex asChild direction="column" gap="6">
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {PROJECTS.map((p) => (
            <li key={p.title}>
              <Flex align="center" gap="2" mb="1">
                <Heading as="h2" size="3" weight="regular">
                  {p.href ? (
                    <Link
                      href={p.href}
                      target="_blank"
                      rel="noreferrer"
                      color="blue"
                    >
                      {p.title}
                    </Link>
                  ) : (
                    p.title
                  )}
                </Heading>
                {p.todo && (
                  <Badge color="gray" variant="soft" size="1">
                    needs copy
                  </Badge>
                )}
              </Flex>
              <Text as="p" size="2" color="gray">
                {p.blurb}
              </Text>
            </li>
          ))}
        </ul>
      </Flex>
    </Container>
  );
}
