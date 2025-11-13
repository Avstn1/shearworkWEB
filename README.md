# 💈 ShearWork

ShearWork is a modern web application built for barbershops and stylists — offering appointment tracking, client insights, and performance analytics in a sleek, data-driven dashboard.

This project uses:
- **Next.js 14** — for the frontend and API routes  
- **Supabase** — as the backend database and authentication layer  
- **Vercel** — for deployment and hosting

---

## 🚀 Features

- 🗓️ Appointment management with real-time updates  
- 💬 Client insights and repeat-visit tracking  
- 💵 Revenue summaries and visual analytics  
- 📊 Weekly and monthly performance dashboards  
- 🔐 Secure authentication via Supabase Auth  
- ⚡ Deployed seamlessly with Vercel

---

## 🧑‍💻 Getting Started

### 1️⃣ Clone the repository

```bash
git clone https://github.com/yourusername/shearwork.git
cd shearwork
```

### 2️⃣ Install dependencies

Make sure you have **Node.js (v18+)** installed, then run:

```bash
npm install
```

### 3️⃣ Set up environment variables

Duplicate the example file and fill in your Supabase credentials. Or the current project lead will provide you with the .env:

```bash
cp .env.example .env.local
```

Add the following values (you’ll need access from the Supabase project owner):

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

If you don’t have these keys yet, please contact the project owner or request access to the **Supabase team** via:
- Email: [austinkbartolome@gmail.com] or [trackingvalid@gmail.com]  
- or open a permissions request in the Supabase project dashboard.

> 🛡️ **Note:** Never commit `.env.local` to the repository — it contains sensitive keys.

---

### 4️⃣ Run the development server

```bash
npm run dev
```

Your app should now be running at  
👉 [http://localhost:3000](http://localhost:3000)

---

## 🧩 Project Structure

```
shearwork/
├── app/                   # Next.js app directory (pages, layouts, routes)
├── components/            # Reusable React components
├── lib/ or utils/         # Helper functions and Supabase client setup
├── styles/                # Tailwind CSS and global styles
├── public/                # Static assets
├── supabase/              # Database schema, migrations (if any)
└── .env.local             # Environment variables (not committed)
```

---

## 🧠 Supabase Setup

If you are setting up Supabase locally or need to connect your own instance:

1. Go to [https://supabase.com](https://supabase.com)  
2. Create a new project  
3. Copy your **Project URL** and **Anon Key** into `.env.local`  
4. Run migrations if applicable (`supabase db push` or use the SQL editor)

To gain access to the production database or analytics, request team access from the Supabase project admin.

---

## 🔄 Deployment

ShearWork is deployed via **Vercel**.  
When pushing to the `main` branch, Vercel automatically builds and deploys the latest version.

To deploy manually:

```bash
vercel
```

You’ll be prompted to link your project. Make sure to add the same environment variables on Vercel’s dashboard under:  
**Project Settings → Environment Variables**

---

## 🧾 Common Commands

| Command | Description |
|----------|--------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Run production server locally |
| `npm run lint` | Run ESLint checks |

---

## 🧑‍🤝‍🧑 Contributing

Contributions are welcome! Please:

1. Fork the repository  
2. Create a new branch:  
   ```bash
   git checkout -b feature/new-feature
   ```
3. Commit your changes with clear messages  
4. Push and open a Pull Request

Before submitting a PR:
- Run `npm run lint` to fix style issues  
- Ensure no secrets or credentials are exposed  
- Include relevant screenshots or context for UI changes

---

## 🧰 Tech Stack

| Tech | Purpose |
|------|----------|
| [Next.js](https://nextjs.org/) | React framework for frontend and APIs |
| [Supabase](https://supabase.com/) | Database, Auth, and Realtime backend |
| [Tailwind CSS](https://tailwindcss.com/) | Styling framework |
| [Recharts](https://recharts.org/) | Data visualization |
| [Vercel](https://vercel.com/) | Hosting and deployment |

---

## 🧑‍💼 Team Access & Permissions

If you’re joining the ShearWork developer team:

- Request access to the **Supabase project**  
- Request access to **Vercel deployment** if you’ll handle deployment or environment setup  
- Coordinate feature branches via GitHub Issues or Discussions  
- All environment variables and private credentials are managed by the project owner — never share them publicly

---

## 🌍 Example `.env.example`

Include this file at the root of your project as a template for environment setup:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional API Keys
NEXT_PUBLIC_APP_ENV=development
```

Developers should copy this template to create their local `.env.local` file before running the app.

---

## 🛟 Support

If you run into any issues:
- Check the [Supabase Docs](https://supabase.com/docs)
- Check the [Next.js Docs](https://nextjs.org/docs)
- Open a GitHub issue or contact the project maintainer

---

## 📜 License

This project is licensed under the **MIT License** — feel free to use, modify, and distribute with attribution.

---

### 💬 Questions?

For development access, issues, or feedback, contact:  
**Project Maintainer:** [yourname@shearwork.app]
