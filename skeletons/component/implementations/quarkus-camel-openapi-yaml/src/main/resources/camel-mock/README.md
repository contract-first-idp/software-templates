# Mocking API operations

This is similar to ignoring missing API operations, as you can tell Camel to mock instead, as shown:

`rest().openApi("petstore-v3.json").missingOperation("mock");`

When using mock, then Camel will (for missing operations) simulate a successful response:

1. attempting to load canned responses from the file system.
2. for GET verbs then attempt to use example inlined in the OpenAPI response section.
3. for other verbs (DELETE, PUT, POST, PATCH) then return the input body as response.
4. if none of the above, then return empty body.

For the url `pet/123` the file `camel-mock/pet/123.json` will be loaded as the response as shown below:

```bash
$ curl http://0.0.0.0:8080/api/v3/pet/123
{
  "pet": "donald the dock"
}
```

If no file is found, then Camel will attempt to find an example from the response section in the OpenAPI specification.

Read more details at https://camel.apache.org/manual/rest-dsl-openapi.html#_mocking_api_operations