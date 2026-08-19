import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { VoyageAIClient } from "voyageai";
import { initDB } from "./db.js";

const sql   = neon(process.env.DATABASE_URL);
const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });

// ── Generate embedding ──
async function embed(text) {
  const res = await voyage.embed({
    input: [text],
    model: "voyage-3-lite",
  });
  return res.data[0].embedding;
}


// ══════════════════════════════════════════
// SEED DATA
// ══════════════════════════════════════════

const guides = [
  {
    title: "How to Create a Page in AEM",
    category: "AEM Authoring",
    tags: ["page", "create", "authoring", "sites"],
    content: `To create a new page in AEM:
1. Navigate to AEM Sites console (Tools → Sites)
2. Browse to the parent folder where you want to create the page
3. Click the "Create" button in the top toolbar
4. Select "Page" from the dropdown menu
5. Choose the appropriate page template (e.g., Content Page, Landing Page)
6. Fill in the page title and name (URL-friendly, lowercase, hyphens)
7. Click "Create" to finish
8. The page opens in Edit mode automatically

Tips:
- Page name becomes the URL slug — keep it short and descriptive
- Use the template that matches your content type
- Always add metadata (title, description) before publishing`,
  },
  {
    title: "How to Publish Content in AEM",
    category: "AEM Authoring",
    tags: ["publish", "activate", "content", "go-live"],
    content: `To publish a page in AEM:

Quick Publish (single page):
1. Navigate to the page in Sites console
2. Select the page (checkbox)
3. Click "Quick Publish" in the toolbar
4. Confirm the publish action
5. Page goes live immediately

Manage Publication (with references):
1. Select the page
2. Click "Manage Publication"
3. Choose "Publish" action
4. Select scope: page only or include children
5. Review referenced assets and pages
6. Click "Publish" to confirm

Scheduled Publication:
1. Open Manage Publication
2. Toggle "Schedule" option
3. Set date and time
4. Confirm — page activates automatically

Note: You need Replication rights to publish.
Submit access request via ServiceNow if you get permission errors.`,
  },
  {
    title: "How to Use AEM Components",
    category: "AEM Authoring",
    tags: ["components", "drag-drop", "parsys", "authoring"],
    content: `AEM Components are building blocks for page content.

Adding a Component:
1. Open page in Edit mode
2. Click the "+" icon in any paragraph system (parsys)
3. Browse component browser or search by name
4. Click component to insert it
5. Configure via the component dialog

Common Components:
- Text: Rich text content with formatting
- Image: Single image with alt text and link
- Teaser: Image + title + description + CTA
- Carousel: Multiple slides with auto-play
- Container: Layout wrapper for other components
- Experience Fragment: Reusable content block

Editing a Component:
1. Click on the component in Edit mode
2. Click the wrench (configure) icon
3. Edit properties in the dialog
4. Click checkmark to save

Moving Components:
- Drag and drop to reorder
- Cut/paste using toolbar actions`,
  },
  {
    title: "How to Request AEM Author Access",
    category: "Access Management",
    tags: ["access", "permissions", "author", "request"],
    content: `To request AEM Author access:

Step 1 — Submit ServiceNow Request:
1. Go to ServiceNow portal (servicenow.company.com)
2. Search "AEM Author Access Request"
3. Fill in the form:
   - Your name and employee ID
   - Manager name and email
   - AEM environment (Dev/Stage/Prod)
   - Content path you need access to
   - Business justification
4. Submit the request

Step 2 — Manager Approval:
- Your manager receives approval email
- Must approve within 5 business days
- You receive email confirmation

Step 3 — Access Provisioned:
- IT provisions access within 2 business days
- You receive AEM login credentials
- Test login at aem.company.com/cf#

Access Levels:
- Author: Create and edit content
- Publisher: Publish content to live site
- DAM User: Upload and manage assets
- Admin: Full AEM access (requires VP approval)`,
  },
  {
    title: "How to Request DAM Access in AEM",
    category: "Access Management",
    tags: ["DAM", "assets", "access", "media", "images"],
    content: `DAM (Digital Asset Management) access allows you to upload and manage images, videos, and documents.

Request Process:
1. Submit ServiceNow ticket: "AEM DAM Access Request"
2. Specify:
   - DAM folder path needed (/content/dam/site/...)
   - Permission level (Read / Write / Admin)
   - Duration (permanent or temporary)
3. Manager approves → IT provisions in 1-2 days

DAM Permission Levels:
- Read: View and download assets
- Write: Upload, edit, move assets
- Admin: Delete assets, manage folders

Uploading Assets:
1. Navigate to AEM Assets (Tools → Assets)
2. Browse to target folder
3. Click "Create" → "Files"
4. Drag files or browse to upload
5. Add metadata (title, tags, alt text)
6. Click "Done"

Best Practices:
- Use descriptive file names (no spaces)
- Add alt text to all images
- Organize assets in correct folder structure
- Maximum file size: 500MB`,
  },
  {
    title: "AEM Content Approval Workflow",
    category: "Workflows",
    tags: ["workflow", "approval", "review", "content"],
    content: `The Content Approval Workflow ensures content is reviewed before going live.

When to Use:
- New page creation
- Major content updates
- Marketing campaign pages
- Legal or compliance content

Starting the Workflow:
1. Select the page in Sites console
2. Click "Create Workflow" in toolbar
3. Select "Content Approval Workflow"
4. Add reviewer email addresses
5. Add comments/instructions
6. Click "Start Workflow"

Workflow Steps:
Step 1: Author submits page for review
Step 2: Reviewer receives email notification
Step 3: Reviewer opens page in AEM
Step 4: Reviewer approves or rejects
  - Approve → page goes to next reviewer or publishes
  - Reject → author receives feedback email
Step 5: All reviewers approve → auto-publish (if configured)

Checking Workflow Status:
- AEM Inbox (bell icon, top right)
- Timeline panel on page properties
- Workflow console: Tools → Workflow → Instances`,
  },
  {
    title: "AEM Scheduled Content Activation",
    category: "Workflows",
    tags: ["schedule", "activation", "publish", "timing"],
    content: `Schedule content to go live at a specific date and time.

Setting Up Scheduled Activation:
1. Select page in Sites console
2. Click "Manage Publication"
3. Action: Publish
4. Toggle "Schedule" to ON
5. Set activation date and time
6. Click "Next" → review references
7. Click "Schedule" to confirm

Managing Scheduled Activations:
- View: Tools → Deployment → Replication → Agents
- Cancel: Select page → Manage Publication → Deactivate → Cancel Schedule

Important Notes:
- Time is in server timezone (UTC) — convert from your local time
- Ensure all referenced assets are already published
- Scheduled activation requires Replication rights
- Maximum scheduling: 6 months in advance

Emergency Override:
- If scheduled content needs immediate publish → Quick Publish overrides schedule
- Contact AEM admin if Quick Publish is blocked`,
  },
  {
    title: "AEM Dispatcher Cache Invalidation",
    category: "Troubleshooting",
    tags: ["dispatcher", "cache", "flush", "invalidation"],
    content: `When content is published but not showing on live site, the dispatcher cache may need clearing.

Understanding Dispatcher Cache:
- AEM serves cached HTML files from dispatcher
- Cache is invalidated automatically on publish
- Sometimes manual flush is needed

Manual Cache Flush:
1. Go to AEM Tools → Deployment → Replication
2. Click "Agents on Publish"
3. Find "Dispatcher Flush Agent"
4. Click "Test Connection" to verify
5. Go to Tools → Operations → Web Console
6. Search "Dispatcher Cache"
7. Click "Invalidate Cache"

Flush Specific Path:
curl -H "CQ-Action: Activate" \
     -H "CQ-Handle: /content/site/en/page" \
     -H "CQ-Path: /content/site/en/page" \
     http://dispatcher-host/dispatcher/invalidate.cache

When Cache Issues Occur:
- Content published but shows old version
- Images not updating after DAM upload
- Navigation not reflecting new pages
- CSS/JS changes not appearing

Prevention:
- Always wait 2-3 minutes after publish
- Use cache-busting for CSS/JS (version query params)
- Configure TTL appropriately in dispatcher.any`,
  },
  {
    title: "AEM Replication Queue Issues",
    category: "Troubleshooting",
    tags: ["replication", "queue", "publish", "stuck"],
    content: `When content is stuck in replication queue and not publishing.

Symptoms:
- Publish action completes but content not on live site
- Replication queue shows pending items
- Error in replication log

Check Replication Queue:
1. Go to Tools → Deployment → Replication
2. Click "Agents on Author"
3. Click "Default Agent (publish)"
4. Click "Test Connection"
   - Should show "Replication test succeeded"
5. Click "Queue" tab to see pending items

Clear Stuck Queue:
1. Go to Default Agent → Queue tab
2. Select all stuck items
3. Click "Clear" to remove
4. Re-publish the content

Common Causes:
- Publisher instance is down
- Network connectivity between Author and Publisher
- Disk space full on Publisher
- Replication agent misconfigured

Escalation:
- If queue keeps filling → contact AEM infrastructure team
- Slack: #aem-support
- Email: aem-admin@company.com`,
  },
];

const workflows = [
  {
    name: "New Page Creation Workflow",
    category: "Content Workflow",
    steps: `1. Author creates new page from template
2. Author adds all content and configures components  
3. Author submits for review via "Request Activation"
4. Content Manager reviews in AEM Inbox
5. If approved → Content Manager activates to Stage
6. QA team validates on Stage environment
7. Content Manager activates to Production
8. Author notified via email`,
    notes: "Typical turnaround: 2-3 business days",
  },
  {
    name: "Emergency Publish Workflow",
    category: "Content Workflow",
    steps: `1. Author contacts Content Manager directly (phone/Slack)
2. Content Manager grants temporary bypass approval
3. Author quick-publishes directly to Production
4. Author documents the emergency in JIRA ticket
5. Post-publish review within 24 hours`,
    notes: "Only for critical fixes — requires VP approval for marketing pages",
  },
  {
    name: "DAM Asset Upload Workflow",
    category: "Asset Workflow",
    steps: `1. Author uploads asset to DAM staging folder
2. DAM team validates file format, size, naming
3. DAM team adds required metadata and tags
4. Asset moved to approved production folder
5. Author notified — asset ready to use in pages`,
    notes: "Standard processing time: 1 business day",
  },
];

const pageOwners = [
  { page_path: "/content/site/en/home",          owner_name: "Sarah Johnson",  owner_email: "sarah.johnson@company.com",  team: "Marketing" },
  { page_path: "/content/site/en/products",       owner_name: "Mike Chen",      owner_email: "mike.chen@company.com",      team: "Product" },
  { page_path: "/content/site/en/about",          owner_name: "Lisa Park",      owner_email: "lisa.park@company.com",      team: "Corporate" },
  { page_path: "/content/site/en/contact",        owner_name: "Tom Wilson",     owner_email: "tom.wilson@company.com",     team: "Marketing" },
  { page_path: "/content/site/en/blog",           owner_name: "Emma Davis",     owner_email: "emma.davis@company.com",     team: "Content" },
  { page_path: "/content/site/en/careers",        owner_name: "HR Team",        owner_email: "hr@company.com",             team: "HR" },
  { page_path: "/content/site/en/legal",          owner_name: "Legal Team",     owner_email: "legal@company.com",          team: "Legal" },
  { page_path: "/content/dam/site",               owner_name: "DAM Team",       owner_email: "dam@company.com",            team: "Digital Assets" },
];

const errorGuides = [
  {
    error_code: "404",
    title: "404 Page Not Found Error",
    category: "HTTP Errors",
    symptoms: "Page returns 404 error. Users see 'Page Not Found'. URL seems correct but page not loading.",
    solution: `Fix 404 errors in AEM:

1. Check page is activated:
   - Go to Sites console
   - Find the page
   - Check if lock icon shows (not activated)
   - Quick Publish if needed

2. Verify URL mapping:
   - Tools → Operations → Web Console
   - Search "Apache Sling URL Mapping"
   - Check mapping for the path

3. Check Vanity URL:
   - Open Page Properties
   - Advanced tab → Vanity URL
   - Ensure vanity URL is correct

4. Clear dispatcher cache:
   - Tools → Deployment → Replication
   - Flush dispatcher cache for the path

5. Check Apache/dispatcher config:
   - Contact infrastructure team
   - Slack: #aem-infrastructure`,
  },
  {
    error_code: "403",
    title: "403 Forbidden Access Error",
    category: "HTTP Errors",
    symptoms: "User gets 403 Forbidden. Cannot access AEM page or function. Permission denied message.",
    solution: `Fix 403 Forbidden errors:

1. Check user permissions:
   - Tools → Security → Users
   - Find user → check group membership
   - Verify they have read access to content path

2. Request additional access:
   - Submit ServiceNow access request
   - Specify exact path and permission needed

3. Check IP allowlist:
   - Some AEM environments restrict by IP
   - Contact AEM admin to whitelist your IP

4. Session expired:
   - Log out and log back in to AEM
   - Clear browser cookies and cache

5. CSRF token issue:
   - Refresh the page
   - If persists → report to AEM team`,
  },
  {
    error_code: "500",
    title: "500 Internal Server Error",
    category: "HTTP Errors",
    symptoms: "AEM shows 500 error. Server error message. Page not loading at all.",
    solution: `Fix 500 Internal Server errors:

1. Check AEM error logs:
   - Tools → Operations → Log Support
   - Download error.log
   - Look for exceptions near the time of error

2. Check OSGi console:
   - Tools → Operations → Web Console
   - Check "Components" tab for errors
   - Look for bundles in red/yellow state

3. Restart affected service:
   - Web Console → Bundles
   - Find problematic bundle
   - Stop → Start

4. Memory issues:
   - Check heap usage in Operations Console
   - Contact infrastructure if heap > 85%

5. Escalate to AEM admin:
   - Slack: #aem-support with error log attached
   - Include exact URL and time of error`,
  },
  {
    error_code: "REPL_001",
    title: "Replication Failed Error",
    category: "Replication Errors",
    symptoms: "Content not publishing to live site. Replication error in queue. Publish button works but changes not visible.",
    solution: `Fix Replication Failed errors:

1. Check replication agent status:
   - Tools → Deployment → Replication → Agents on Author
   - Test Connection on Default Agent
   - Should show "Replication test succeeded"

2. Check Publisher health:
   - Tools → Operations → Health Check
   - Look for Publisher connectivity issues

3. Clear replication queue:
   - Default Agent → Queue tab
   - Clear stuck items
   - Re-publish content

4. Check network:
   - Ping publisher from author instance
   - Contact infrastructure if unreachable

5. Check disk space:
   - Publisher may have full disk
   - Contact infrastructure team`,
  },
];

// ══════════════════════════════════════════
// SEED FUNCTION
// ══════════════════════════════════════════
async function seed() {
  console.log("🌱 Seeding AEM Knowledge Base...\n");
  await initDB();


  // Clear existing data
  await sql`TRUNCATE aem_guides, workflows, page_owners, error_guides RESTART IDENTITY CASCADE`;

  // Seed guides with embeddings
  console.log("📚 Inserting guides + generating embeddings...");
  for (const guide of guides) {
    const textToEmbed = `${guide.title} ${guide.content}`;
    const embedding   = await embed(textToEmbed);
    const embStr      = JSON.stringify(embedding);

    await sql`
      INSERT INTO aem_guides (title, category, content, tags, embedding)
      VALUES (${guide.title}, ${guide.category}, ${guide.content}, ${guide.tags}, ${embStr}::vector)
    `;
    console.log(`  ✅ ${guide.title}`);
  }

  // Seed workflows with embeddings
  console.log("\n🔄 Inserting workflows + generating embeddings...");
  for (const wf of workflows) {
    const textToEmbed = `${wf.name} ${wf.steps}`;
    const embedding   = await embed(textToEmbed);
    const embStr      = JSON.stringify(embedding);

    await sql`
      INSERT INTO workflows (name, category, steps, notes, embedding)
      VALUES (${wf.name}, ${wf.category}, ${wf.steps}, ${wf.notes}, ${embStr}::vector)
    `;
    console.log(`  ✅ ${wf.name}`);
  }

  // Seed page owners (no embeddings needed)
  console.log("\n👤 Inserting page owners...");
  for (const owner of pageOwners) {
    await sql`
      INSERT INTO page_owners (page_path, owner_name, owner_email, team)
      VALUES (${owner.page_path}, ${owner.owner_name}, ${owner.owner_email}, ${owner.team})
      ON CONFLICT (page_path) DO UPDATE SET
        owner_name  = EXCLUDED.owner_name,
        owner_email = EXCLUDED.owner_email,
        team        = EXCLUDED.team
    `;
    console.log(`  ✅ ${owner.page_path}`);
  }

  // Seed error guides with embeddings
  console.log("\n🚨 Inserting error guides + generating embeddings...");
  for (const err of errorGuides) {
    const textToEmbed = `${err.title} ${err.symptoms} ${err.solution}`;
    const embedding   = await embed(textToEmbed);
    const embStr      = JSON.stringify(embedding);

    await sql`
      INSERT INTO error_guides (error_code, title, category, symptoms, solution, embedding)
      VALUES (${err.error_code}, ${err.title}, ${err.category}, ${err.symptoms}, ${err.solution}, ${embStr}::vector)
    `;
    console.log(`  ✅ ${err.title}`);
  }

  console.log("\n✅ Seeding complete!");
  console.log(`   ${guides.length} guides`);
  console.log(`   ${workflows.length} workflows`);
  console.log(`   ${pageOwners.length} page owners`);
  console.log(`   ${errorGuides.length} error guides`);
}

seed().catch(console.error);
