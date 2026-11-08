# BoardGameGeek website fixtures (F008, research R2/R3)

Recorded by the owner on 2026-11-08 (T001), cookies, usernames and the collid (→ 123456789) removed:
`signin.json`, `status-editdata.url`, `save-status*.form`, `ownership-editdata.*`, `save-ownership*.*`.

Built for the tests, not recorded:

- `signin-rejected-401.json`, `signin-rejected-200.json`: plausible answers for a wrong password.
- `collection-item.xml`, `collection-item-none.xml`: the official API's answer for one game
  (`/xmlapi2/collection?username=<u>&id=425029`), in the shape of `tests/fixtures/bgg-xml/collection-games.xml`.
