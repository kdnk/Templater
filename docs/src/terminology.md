# Terminology

To understand how [Templater](https://github.com/SilentVoid13/Templater) works, let's define a few terms:

- A **template** is a file that contains **[commands](./commands/overview.md)**.
- A text snippet that starts with an opening tag `<%`, ends with a closing tag `%>` is what we will call a **[command](./commands/overview.md)**.
- A **function** is an object that we can invoke inside a **command** and that returns a value (the replacement string)

Templater includes [internal functions](./internal-functions/overview.md).
They are **predefined** functions that are built within the plugin.
As an example, `tp.date.now` is an internal function that will return the current date.

### Example

The following template contains 2 commands, calling 2 different internal functions:

```
Yesterday: <% tp.date.yesterday("YYYY-MM-DD") %>
Tomorrow: <% tp.date.tomorrow("YYYY-MM-DD") %>
```

We'll see in the next part the syntax required to write some commands.
