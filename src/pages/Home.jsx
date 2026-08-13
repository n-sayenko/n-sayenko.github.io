import { Container, Flex, Link, Text } from "@radix-ui/themes";
import Canvas from "../components/Canvas";
import Nav from "../components/Nav";

export default function Home() {
  return (
    <Container size="2" px="4">
      <Flex direction="column" className="page-column">
        <Nav current="home" />

        <Flex
          direction="column"
          align="center"
          justify="center"
          gap="4"
          style={{ flex: 1, paddingBottom: "48px" }}
        >
          <Canvas />

          <Flex
            direction="column"
            align="center"
            gap="3"
            style={{ maxWidth: "34em" }}
          >
            <Text as="p" size="3" align="center" color="gray" highContrast>
              Hi, I'm Nataliya. I currently work at{" "}
              <Link
                href="https://cooking.nytimes.com/"
                target="_blank"
                rel="noreferrer"
                color="blue"
              >
                NYT Cooking
              </Link>{" "}
              as a senior software engineer. I read a lot, paint, and I'm currently learning to handstand.
            </Text>

            <Text as="p" size="3" align="center" color="gray" highContrast>
              I love to chat, about almost anything. Also love to meet up for
              coffee :){" "}
              <Link
                href="mailto:nataliyasayenko@gmail.com"
                color="blue"
                weight="bold"
              >
                Email Me
              </Link>
              .
            </Text>
          </Flex>
        </Flex>
      </Flex>
    </Container>
  );
}
