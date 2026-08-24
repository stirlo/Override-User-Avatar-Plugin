# Override User Avatars

Override avatars for multiple users in Revenge, Vendetta, and Kettu clients. Each user can have a primary image URL and an optional fallback URL, managed from a list in the plugin settings.

**Status:** Vibe coded without remorse, build-tested locally, and awaiting phone and iPad field testing.

## How to install

Paste this link into the Install Plugin section of the Revenge client:

https://stirlo.github.io/Override-User-Avatar-Plugin/Override-User-Avatars

Open the plugin settings, enter a user ID and primary image URL, optionally enter a fallback URL, then tap Add. Tap an existing user row to remove that override.

The fallback URL is selected only when the primary field is empty. It is not an automatic retry when an image fails to load. The settings form requires a primary URL when adding an entry.

The install URL points to a polymanifest deployment. The client reads the generated `manifest.json`, loads `index.js`, and checks the bundle against its generated SHA-256 hash.

## Known issues

The plugin does not change profile pictures in notifications.

## Credit

Forked from [Furretar/Override-User-Avatars-Revenge-Plugin](https://github.com/Furretar/Override-User-Avatars-Revenge-Plugin). All credit to the original author for the base implementation. This fork adds multi-user and fallback URL support.

## Revenge Plugin Template

Created with the [Vendetta plugin template](https://github.com/vendetta-mod/Vendetta).

## Preview

<img src="https://github.com/user-attachments/assets/81cf73b4-28e3-43f4-9d9c-2050dd027a5b" width="40%"><img src="https://github.com/user-attachments/assets/cfbf3e0e-dfbc-4d36-abd1-37880cd5b54d" width="40%">
