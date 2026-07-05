# Cloudflare Pages Migration Plan

This document outlines the step-by-step plan to migrate your application from GitHub Pages to Cloudflare Pages (Serverless) and provides a detailed pricing breakdown based on your expected traffic.

## 💰 Pricing Analysis

Based on your approximate traffic of **< 1,000 hits/hour** (roughly 24,000 hits/day or ~720,000 hits/month), you will easily fit within **Cloudflare's Free Tier**.

Here is the breakdown of why your cost will be **$0.00 / month**:

| Feature | Your Usage | Cloudflare Free Tier Limits | Cost |
| :--- | :--- | :--- | :--- |
| **Static Assets** (HTML, CSS, JS, Images) | ~720k requests/mo | **Unlimited** requests & bandwidth | **Free** |
| **Serverless Functions** (Pages Functions / Workers) | < 24,000 requests/day | **100,000** requests per day | **Free** |
| **Custom Domains** | 1 or more | **Unlimited** custom domains | **Free** |
| **SSL/TLS Certificates** | 1 | **Included automatically** | **Free** |

> [!TIP]
> Since your traffic is well below 4,166 hits/hour (which is the hourly equivalent of the 100k/day limit), you won't need to upgrade to the $5/month Paid Plan anytime soon, even if every single hit invokes a serverless function!

---

## 🚀 Migration Plan

Migrating from GitHub Pages to Cloudflare Pages is completely seamless and requires zero code changes for standard static sites. Cloudflare integrates directly with your GitHub repository.

### Step 1: Create a Cloudflare Account
1. Go to [Cloudflare's website](https://dash.cloudflare.com/sign-up) and sign up for a free account if you don't already have one.
2. Verify your email address.

### Step 2: Connect Your GitHub Repository
1. Log in to the Cloudflare Dashboard.
2. On the left sidebar, click on **Workers & Pages**.
3. Click the **Create application** button.
4. Select the **Pages** tab and click **Connect to Git**.
5. Choose **GitHub** and authorize Cloudflare to access your repositories.
6. Select your `Badminton` repository from the list and click **Begin setup**.

### Step 3: Configure Build & Deployment Settings
Cloudflare needs to know how to build your project. For a basic HTML/CSS/JS site, the setup is very simple:

- **Project name:** Choose a name (this will be used for your temporary `*.pages.dev` subdomain).
- **Production branch:** `main` (or whichever branch you currently deploy from).
- **Framework preset:** `None` (Since it looks like you are using plain HTML files like `dashboard.html` and `settings.html`).
- **Build command:** Leave this blank.
- **Build output directory:** `/` (or leave it blank, meaning the root directory).

> [!IMPORTANT]
> If your project requires a build step in the future (e.g., using React, Vite, or npm scripts), you can easily update the Build command (e.g., `npm run build`) and Output directory (e.g., `dist`) in these settings.

### Step 4: Deploy
1. Click **Save and Deploy**.
2. Cloudflare will clone your repository, build it (if necessary), and deploy it to a global network.
3. You will be provided with a free `.pages.dev` subdomain (e.g., `https://badminton-app.pages.dev`) to view your live site.

### Step 5: Add a Custom Domain (Optimized for your GoDaddy setup)
Since your domain is registered with **GoDaddy** but you are **already using Cloudflare for DNS**, this step is incredibly easy:
1. In your Cloudflare Pages project settings, go to the **Custom Domains** tab.
2. Click **Set up a custom domain**.
3. Enter your custom domain name (e.g., `badminton.com` or `app.badminton.com`).
4. Because Cloudflare already manages your DNS, it will **automatically** add the required `CNAME` record to your Cloudflare DNS settings without you needing to log into GoDaddy. 
5. Cloudflare will also automatically provision and manage a free SSL certificate for you!

### Step 6: Disable GitHub Pages
Once you have verified the Cloudflare deployment is working perfectly, you should turn off GitHub Pages to prevent duplicate hosting.
1. Go to your repository on GitHub.
2. Click on **Settings** > **Pages** (under the Code and automation section on the left).
3. Under the "Build and deployment" source, change it from "Deploy from a branch" to "None" or unpublish the site.

---

## 🛠️ Adding Serverless Functions (Future Proofing)
If you ever want to add serverless logic (like a backend API, database connections, or authentication), you can do so easily with **Cloudflare Pages Functions**.

Simply create a `/functions` folder in the root of your repository and add JavaScript/TypeScript files. Cloudflare automatically routes them (e.g., `/functions/api/hello.js` becomes accessible at `yourdomain.com/api/hello`).
