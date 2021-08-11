#!/usr/bin/env node

const { Command } = require("commander");
const got = require("got");

const program = new Command();

program
  .requiredOption("--endpoint <endpoint>", "endpoint to diagnose")
  .option(
    "--origin <origin>",
    "origin (for testing CORS headers)",
    "https://studio.apollographql.com"
  );

program.parse(process.argv);

const options = program.opts();

(async () => {
  let hasIdentifiedProblem = false;
  const identifyProblem = (...problemDescription) => {
    hasIdentifiedProblem = true;
    console.log('⚠️ ', ...problemDescription);
  };
  try {
    console.log(`Diagnosing ${options.endpoint}`);
    const optionsResponse = await got(options.endpoint, {
      method: "OPTIONS",
      headers: {
        origin: options.origin,
      },
      throwHttpErrors: false,
    });

    if (optionsResponse.statusCode === 401) {
      identifyProblem(
        `OPTIONS response returned 401. Are authorization headers or cookies required?`
      );
    } else if (optionsResponse.statusCode === 404) {
      identifyProblem(
        `OPTIONS response returned 404. Is the url correct? Are authorization headers or cookies required?`
      );
    }

    if (
      !(optionsResponse.headers["access-control-allow-methods"] && optionsResponse.headers["access-control-allow-methods"].includes("POST"))
    ) {
      identifyProblem(
        `OPTIONS response is missing header 'access-control-allow-methods: POST'`
      );
    }

    const postResponse = await got.post(options.endpoint, {
      json: {
        query: `query Ping { __typename }`,
      },
      headers: {
        origin: options.origin,
      },
      throwHttpErrors: false,
    });

    if (postResponse.statusCode === 401) {
      identifyProblem(
        `POST response returned 401. Are authorization headers or cookies required?`
      );
    } else if (postResponse.statusCode === 404) {
      identifyProblem(
        `POST response returned 404. Is the url correct? Are authorization headers or cookies required?`
      );
    }

    if (
      !postResponse.headers["access-control-allow-origin"] ||
      (postResponse.headers["access-control-allow-origin"] !== "*" &&
        postResponse.headers["access-control-allow-origin"] !== options.origin)
    ) {
      identifyProblem(
        [
          `POST response missing 'access-control-allow-origin' header.`,
          `If using cookie-based authentication, the following headers are required from your endpoint: `,
          `    access-control-allow-origin: https://studio.apollographql.com`,
          `    access-control-allow-credentials: true`,
          `Otherwise, a wildcard value would work:`,
          `    access-control-allow-origin: *`,
        ].join("\n")
      );
      console.log(`(📫 Interested in previewing a local tunnel to bypass CORS requirements? Please let us know at https://docs.google.com/forms/d/e/1FAIpQLScUCi3PdMerraiy6GpD-QiC_9KEKVHr4oDL5Vef5fIvzqqQWg/viewform )`)
    }
  } catch (e) {
    switch (e.code) {
      case "ENOTFOUND":
        identifyProblem(
          `Could not resolve (ENOTFOUND)\nIs the address correct?\nIs the server running?`
        );
        break;
      case "ECONNREFUSED":
        identifyProblem(
          `Connection refused (ECONNREFUSED)\nIs the address correct?\nIs the server running?`
        );
        break;
      default:
        // unexpected error
        identifyProblem(
          `Failed to diagnose what went wrong. Here's the error: `,
          e,
          e.message
        );
        console.log(
          `Would you care to let us know about this? Please mailto:explorer-feedback@apollographql.com`
        );
    }
  }

  if (!hasIdentifiedProblem) {
    console.log(
      `Could not find any problems with the endpoint. Would you please to let us know about this at explorer-feedback@apollographql.com 🙏`
    );
  }
})();
