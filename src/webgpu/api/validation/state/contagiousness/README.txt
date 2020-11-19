Tests that any object created from an invalid object produces an invalid object.
Excludes lost devices (devices can't be invalid, only lost).
Excludes command encoding from invalid objects.

- x= every such method in the API, e.g.:
    - (invalid texture).createView()
    - device.createBindGroup(... (invalid buffer) ...)

TODO: implement (or decide that this coverage should be distributed across other test files).
