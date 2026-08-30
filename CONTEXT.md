# Reply

Reply is a shared work queue that happens to contain email: teams own conversations with status, an assignee, company context, and assisted drafting.

## Language

**Workspace**:
The tenant boundary. All product data belongs to exactly one workspace.
_Avoid_: Organization, team, account

**Inbox**:
A named work queue inside a workspace (e.g. Sales, Accounts, Support). Users work inboxes; channels feed them.
_Avoid_: Folder, mailbox, queue

**Channel**:
A connected email source (e.g. a Gmail or Outlook address) that delivers mail into exactly one inbox. Demo channels are simulated connectors; no real OAuth exists.
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
