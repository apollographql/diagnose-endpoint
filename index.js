#!/usr/bin/env node

const { Command } = require("commander");
const got = require("got");
const { buildClientSchema, validateSchema } = require('graphql');

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
  let hasIdentifiedCorsProblem = false;
  const identifyProblem = (...problemDescription) => {
    hasIdentifiedProblem = true;
    console.log("⚠️ ", ...problemDescription);
  };
  const identifyCorsProblem = (...problemDescription) => {
    identifyProblem(...problemDescription);
    hasIdentifiedCorsProblem = true;
  }

  try {
    console.log(`Diagnosing ${options.endpoint}`);
    const optionsResponse = await got(options.endpoint, {
      method: "OPTIONS",
      headers: {
        "access-control-request-method": "POST",
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
      !(
        optionsResponse.headers["access-control-allow-methods"] &&
        optionsResponse.headers["access-control-allow-methods"].includes("POST")
      )
    ) {
      identifyCorsProblem(
        `OPTIONS response is missing header 'access-control-allow-methods: POST'`
      );
    }

    const pingResponse = await got.post(options.endpoint, {
      json: {
        query: `query Ping { __typename }`,
      },
      headers: {
        origin: options.origin,
      },
      throwHttpErrors: false,
    });

    if (pingResponse.statusCode === 401) {
      identifyProblem(
        `POST response returned 401. Are authorization headers or cookies required?`
      );
    } else if (pingResponse.statusCode === 404) {
      identifyProblem(
        `POST response returned 404. Is the url correct? Are authorization headers or cookies required?`
      );
    }

    if (
      !pingResponse.headers["access-control-allow-origin"] ||
      (pingResponse.headers["access-control-allow-origin"] !== "*" &&
        pingResponse.headers["access-control-allow-origin"] !== options.origin)
    ) {
      identifyCorsProblem(
        [
          `POST response missing 'access-control-allow-origin' header.`,
          `If using cookie-based authentication, the following headers are required from your endpoint: `,
          `    access-control-allow-origin: https://studio.apollographql.com`,
          `    access-control-allow-credentials: true`,
          `Otherwise, a wildcard value would work:`,
          `    access-control-allow-origin: *`,
        ].join("\n")
      );
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

  if (hasIdentifiedCorsProblem) {
    console.log(
      `(📫 Interested in previewing a local tunnel to bypass CORS requirements? Please let us know at https://docs.google.com/forms/d/e/1FAIpQLScUCi3PdMerraiy6GpD-QiC_9KEKVHr4oDL5Vef5fIvzqqQWg/viewform )`
    );
  }

  if (!hasIdentifiedProblem) {
    // Only check for introspection problems if there are no other problems found
    const miniIntrospectionQueryResponse = await got.post(options.endpoint, {
      json: {
        query: `query MiniIntrospectionQuery {
          __schema {
            queryType { name }
            mutationType { name }
            subscriptionType { name }
          }
        }
      `,
      },
      headers: {
        origin: options.origin,
      },
      throwHttpErrors: false,
    });

    try {
      const responseData = JSON.parse(miniIntrospectionQueryResponse.body)

      if (!('data' in responseData) || !('__schema' in responseData.data)) {
        identifyProblem(`Introspection query received a response of ${miniIntrospectionQueryResponse.body}. Does introspection need to be turned on?`)
      } else {
        const schemaFromIntrospection = buildClientSchema(responseData.data);
        const validationErrors = validateSchema(schemaFromIntrospection);
        if (validationErrors.length) {
          identifyProblem(
            `Invalid schema from introspection: ${validationErrors}`
          );
        }
      }
    } catch (e) {
      identifyProblem(
        `Introspection query could not parse "${miniIntrospectionQueryResponse.body}" As valid json. Here is the error: `,
        e,
        e.message
      );
    }

  }

  if (!hasIdentifiedProblem) {
    console.log(
      `Failed to diagnose any problems with the endpoint. Please email explorer-feedback@apollographql.com with the endpoint to help us investigate🙏`
    );
  }
})();
