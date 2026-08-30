# Reply

Reply is a shared work queue that happens to contain email: teams own conversations with status, an assignee, company context, and assisted drafting.

## Language

**Workspace**:
The tenant boundary. All product data belongs to exactly one workspace.
_Avoid_: Organization, team, account

**Inbox**:
A named work queue inside a workspace (e.g. Sales, Accounts, Support) and the only container members work in. A shared inbox belongs to the team; a personal inbox is visible only to its owner. Channels are connected from the inbox and feed it.
_Avoid_: Folder, mailbox, queue

**Channel**:
A connected source of conversations (Gmail, Outlook, WhatsApp, or SMS) belonging to exactly one inbox, addressed by mailbox or phone number. A channel has no visibility of its own: it inherits the inbox's kind and access. Provider authorization is simulated, and each connection is backed by a sample dataset.
_Avoid_: Connector, integration, account

**Thread**:
An owned conversation and the unit of work: status, assignee, and labels attach here, never to individual messages.
_Avoid_: Email (as a unit of work), ticket, case

**Message**:
One inbound or outbound email within a thread, ordered by time.
_Avoid_: Email (when the thread is meant), reply (as a noun for the record)

**Note**:
An internal comment on a thread, visible only to workspace members and never sent to the customer.
_Avoid_: Comment, internal message

**Mention**:
An @user reference inside a note that calls a teammate's attention to the thread.
_Avoid_: Tag (a person)

**Label**:
A shared, workspace-defined category applied to threads (e.g. "urgent").
_Avoid_: Tag (a thread), category

**Assignee**:
The single user currently responsible for a thread. A thread has at most one assignee at a time.
_Avoid_: Owner (plural), assignees

**Company Profile**:
A persisted, normalized Context.dev summary of a sender's company, keyed by domain within a workspace.
_Avoid_: Enrichment record, company card (the UI showing a profile)
