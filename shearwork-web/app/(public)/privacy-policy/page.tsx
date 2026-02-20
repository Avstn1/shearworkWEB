'use client';

import { motion } from 'framer-motion';
import {
  Shield, BookOpen, ClipboardList, Settings, Link2,
  Share2, Mail, Calendar, Lock, Globe, CheckCircle,
  Cookie, Baby, RefreshCw,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Landing/Footer';

// ── Types ─────────────────────────────────────────────────────────────────────
interface SectionCardProps {
  icon: React.ReactNode;
  title: string;
  num: string;
  delay?: number;
  children: React.ReactNode;
}

interface DefItemProps {
  term: string;
  desc: string;
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionCard({ icon, title, num, delay = 0, children }: SectionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.45, delay, ease: 'easeOut' }}
      className="rounded-2xl mb-5 overflow-hidden border border-white/[0.09] bg-[#1a1a1a] hover:border-[#73aa57]/20 transition-colors duration-300"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.09]">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #73aa57 0%, #5b8f52 100%)',
            boxShadow: '0 4px 14px rgba(115,170,87,0.35)',
          }}
        >
          {icon}
        </div>
        <span className="flex-1 text-white font-bold text-[15px] tracking-tight">{title}</span>
        <span className="font-mono text-xs text-white/30">{num}</span>
      </div>

      {/* Body */}
      <div className="px-6 py-5">{children}</div>
    </motion.div>
  );
}

function BodyText({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm leading-[1.8] text-white/55 mb-3 last:mb-0">{children}</p>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-widest text-[#73aa57] mt-5 mb-2 first:mt-0">
      {children}
    </p>
  );
}

function DefItem({ term, desc }: DefItemProps) {
  return (
    <div className="flex gap-3 rounded-xl p-3 mb-2 bg-white/[0.03] border border-white/[0.09]">
      <span className="font-mono text-[11px] font-medium text-[#73aa57] w-24 flex-shrink-0 pt-0.5">
        {term}
      </span>
      <span className="text-sm leading-relaxed text-white/55">{desc}</span>
    </div>
  );
}

function BulletItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 mb-2">
      <span
        className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
        style={{ background: '#73aa57', boxShadow: '0 0 5px rgba(115,170,87,0.7)' }}
      />
      <span className="text-sm leading-[1.8] text-white/55">{children}</span>
    </div>
  );
}

function HighlightBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4 mt-4 bg-[rgba(115,170,87,0.08)] border border-[rgba(115,170,87,0.22)]">
      <p className="text-sm leading-relaxed text-white/70">{children}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PrivacyPolicyPage() {
  return (
    <>
      <Navbar />

      <main
        className="min-h-screen relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #181818 0%, #1a1a1a 30%, #1c1e1c 70%, #181818 100%)' }}
      >
        {/* Ambient glows */}
        <div
          className="absolute top-[-80px] left-[-100px] w-72 h-72 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(115,170,87,0.4)', opacity: 0.1 }}
        />
        <div
          className="absolute bottom-[10%] right-[-80px] w-64 h-64 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(115,170,87,0.4)', opacity: 0.08 }}
        />

        <div className="relative z-10 max-w-3xl mx-auto px-5 sm:px-6 pt-28 pb-24">

          {/* ── Hero ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="mb-10"
          >
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-4 bg-[rgba(115,170,87,0.08)] border border-[rgba(115,170,87,0.22)]">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: '#73aa57', boxShadow: '0 0 6px rgba(115,170,87,0.8)' }}
              />
              <span className="font-mono text-[11px] font-medium uppercase tracking-widest text-[#73aa57]">
                Privacy Policy
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight leading-[1.1] mb-3">
              Your data,{' '}
              <span className="text-[#73aa57]">your trust.</span>
            </h1>
            <p className="text-sm text-white/55">
              We're committed to transparency about how we collect and use your information.
            </p>
          </motion.div>

          {/* Updated */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="font-mono text-[11px] text-white/30 text-right mb-8"
          >
            Last updated — <span className="text-[#73aa57]">February 18, 2026</span>
          </motion.p>

          {/* ── 01 Overview ── */}
          <SectionCard icon={<Shield size={16} color="#000" />} title="Overview" num="01" delay={0.05}>
            <BodyText>
              Corva ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains
              how your personal information is collected, used, and disclosed by Corva.
            </BodyText>
            <BodyText>
              This Privacy Policy applies to our website and its associated subdomains (collectively, our
              "Service") alongside our application, Corva. By accessing or using our Service, you signify that
              you have read, understood, and agree to our collection, storage, use, and disclosure of your
              personal information as described in this Privacy Policy and our Terms of Service.
            </BodyText>
          </SectionCard>

          {/* ── 02 Definitions ── */}
          <SectionCard icon={<BookOpen size={16} color="#000" />} title="Definitions & Key Terms" num="02" delay={0.1}>
            <BodyText>
              To help explain things as clearly as possible, every time these terms are referenced they are
              strictly defined as:
            </BodyText>
            <DefItem term="Cookie" desc="Small amount of data generated by a website and saved by your web browser. Used to identify your browser, provide analytics, and remember preferences or login information." />
            <DefItem term="Company" desc="Cruzthebarber Inc, 278 Ranee Ave, North York, ON M6A 1N6 — responsible for your information under this Privacy Policy." />
            <DefItem term="Country" desc="Canada, where Corva and its owners/founders are based." />
            <DefItem term="Customer" desc="The company, organization, or person that signs up to use the Corva Service to manage relationships with your consumers or service users." />
            <DefItem term="Device" desc="Any internet-connected device such as a phone, tablet, or computer that can be used to visit Corva and use the services." />
            <DefItem term="IP Address" desc="A number assigned to every internet-connected device. Can often be used to identify the location from which a device is connecting." />
            <DefItem term="Personnel" desc="Individuals employed by Corva or under contract to perform a service on behalf of one of the parties." />
            <DefItem term="Personal Data" desc="Any information that directly or indirectly allows for the identification or identifiability of a natural person." />
            <DefItem term="Service" desc="The service provided by Corva as described in the relative terms and on this platform." />
            <DefItem term="You" desc="A person or entity that is registered with Corva to use the Services." />
          </SectionCard>

          {/* ── 03 What we collect ── */}
          <SectionCard icon={<ClipboardList size={16} color="#000" />} title="What Information Do We Collect?" num="03" delay={0.15}>
            <BodyText>
              We collect information from you when you visit our website/app, register on our site, place an
              order, subscribe to our newsletter, respond to a survey, or fill out a form.
            </BodyText>
            <SectionLabel>Information we collect</SectionLabel>
            <BulletItem>Name / Username</BulletItem>
            <BulletItem>Phone Numbers</BulletItem>
            <BulletItem>Email Addresses</BulletItem>
            <BulletItem>Password (stored encrypted)</BulletItem>
            <HighlightBox>
              We also collect information from mobile devices for a better user experience — these features are{' '}
              <strong className="text-[#73aa57] font-semibold">completely optional</strong>.
            </HighlightBox>
          </SectionCard>

          {/* ── 04 How we use ── */}
          <SectionCard icon={<Settings size={16} color="#000" />} title="How Do We Use Your Information?" num="04" delay={0.2}>
            <BodyText>Any of the information we collect from you may be used in one of the following ways:</BodyText>
            <BulletItem>To personalize your experience and better respond to your individual needs</BulletItem>
            <BulletItem>To improve our website/app based on information and feedback we receive</BulletItem>
            <BulletItem>To improve customer service and effectively respond to support needs</BulletItem>
            <BulletItem>To process transactions</BulletItem>
            <BulletItem>To administer contests, promotions, surveys, or other site features</BulletItem>
            <BulletItem>To send periodic emails</BulletItem>
          </SectionCard>

          {/* ── 05 Third-party ── */}
          <SectionCard icon={<Link2 size={16} color="#000" />} title="Third-Party Information" num="05" delay={0.25}>
            <SectionLabel>End User Data</SectionLabel>
            <BodyText>
              Corva will collect End User Data necessary to provide the Corva services to our customers. End
              users may voluntarily provide us with information they have made available on social media
              websites. You can control how much of your information social media websites make public by
              visiting those websites and changing your privacy settings.
            </BodyText>
            <SectionLabel>Customer Data from Third Parties</SectionLabel>
            <BodyText>
              We receive some information from third parties when you contact us — for example, automated fraud
              detection services when you submit your email address. We also occasionally collect information
              that is made publicly available on social media websites.
            </BodyText>
          </SectionCard>

          {/* ── 06 Sharing ── */}
          <SectionCard icon={<Share2 size={16} color="#000" />} title="Do We Share Your Information?" num="06" delay={0.3}>
            <BodyText>
              We may share the information that we collect, both personal and non-personal, with third parties
              such as advertisers, contest sponsors, promotional and marketing partners, and others who provide
              our content or whose products or services may interest you.
            </BodyText>
            <BodyText>
              We may engage trusted third-party service providers to perform functions such as hosting and
              maintaining our servers, database storage and management, e-mail management, credit card
              processing, and customer service.
            </BodyText>
            <BodyText>
              We may also disclose personal and non-personal information to government or law enforcement
              officials as we believe necessary to respond to legal process, protect rights and interests, or
              comply with applicable laws, rules, and regulations.
            </BodyText>
          </SectionCard>

          {/* ── 07 Email ── */}
          <SectionCard icon={<Mail size={16} color="#000" />} title="How Do We Use Your Email?" num="07" delay={0.35}>
            <BodyText>
              By submitting your email address on this website/app, you agree to receive emails from us. You
              can cancel your participation in any of these email lists at any time by clicking on the opt-out
              link included in each email.
            </BodyText>
            <BodyText>
              We only send emails to people who have authorized us to contact them, either directly or through
              a third party. We do not send unsolicited commercial emails.
            </BodyText>
            <HighlightBox>
              Every email we send includes detailed{' '}
              <strong className="text-[#73aa57] font-semibold">unsubscribe instructions</strong> at the bottom.
            </HighlightBox>
          </SectionCard>

          {/* ── 08 Retention ── */}
          <SectionCard icon={<Calendar size={16} color="#000" />} title="How Long Do We Keep Your Information?" num="08" delay={0.4}>
            <BodyText>
              We keep your information only so long as we need it to provide Corva to you and fulfill the
              purposes described in this policy. This is also the case for anyone that we share your information
              with and who carries out services on our behalf.
            </BodyText>
            <BodyText>
              When we no longer need to use your information and there is no need for us to keep it to comply
              with our legal or regulatory obligations, we'll either remove it from our systems or depersonalize
              it so that we can't identify you.
            </BodyText>
          </SectionCard>

          {/* ── 09 Security ── */}
          <SectionCard icon={<Lock size={16} color="#000" />} title="How Do We Protect Your Information?" num="09" delay={0.45}>
            <BodyText>
              We implement a variety of security measures to maintain the safety of your personal information.
              We offer the use of a secure server. All supplied sensitive/credit information is transmitted via
              Secure Socket Layer (SSL) technology and then encrypted into our payment gateway provider's
              database, only accessible by those with special access rights.
            </BodyText>
            <BodyText>
              After a transaction, your private information (credit cards, social security numbers, financials,
              etc.) is never kept on file. We cannot, however, ensure or warrant the absolute security of any
              information you transmit to Corva.
            </BodyText>
          </SectionCard>

          {/* ── 10 International ── */}
          <SectionCard icon={<Globe size={16} color="#000" />} title="International Data Transfers" num="10" delay={0.5}>
            <BodyText>
              Corva is incorporated in Canada. Information collected via our website may be transferred from
              time to time to our offices, personnel, or third parties located throughout the world, and may be
              viewed and hosted anywhere in the world, including countries that may not have laws of general
              applicability regulating the use and transfer of such data.
            </BodyText>
            <BodyText>
              To the fullest extent allowed by applicable law, by using any of the above, you voluntarily
              consent to the trans-border transfer and hosting of such information.
            </BodyText>
          </SectionCard>

          {/* ── 11 Your rights ── */}
          <SectionCard icon={<CheckCircle size={16} color="#000" />} title="Can I Update or Correct My Information?" num="11" delay={0.55}>
            <BodyText>
              Customers have the right to request the restriction of certain uses and disclosures of personally
              identifiable information. You can contact us to:
            </BodyText>
            <BulletItem>Update or correct your personally identifiable information</BulletItem>
            <BulletItem>
              Change your preferences with respect to communications and other information you receive from us
            </BulletItem>
            <BulletItem>
              Delete the personally identifiable information maintained about you on our systems by cancelling
              your account
            </BulletItem>
            <BodyText>
              To protect your privacy and security, we may take reasonable steps (such as requesting a unique
              password) to verify your identity before granting profile access or making corrections.
            </BodyText>
          </SectionCard>

          {/* ── 12 Cookies ── */}
          <SectionCard icon={<Cookie size={16} color="#000" />} title="Cookies & Tracking Technologies" num="12" delay={0.6}>
            <BodyText>
              Corva uses "Cookies" to identify the areas of our website that you have visited. We use Cookies
              to enhance the performance and functionality of our website/app but they are non-essential to
              their use.
            </BodyText>
            <SectionLabel>Technologies we use</SectionLabel>
            <BulletItem>
              <strong className="text-white font-semibold">Cookies</strong> — Small pieces of data stored on
              your computer or mobile device by your web browser
            </BulletItem>
            <BulletItem>
              <strong className="text-white font-semibold">Local Storage</strong> — Provides web apps with
              methods for storing client-side data with greatly enhanced capacity
            </BulletItem>
            <BulletItem>
              <strong className="text-white font-semibold">Sessions</strong> — Small pieces of data stored on
              your device to identify the areas of our website you have visited
            </BulletItem>
            <HighlightBox>
              We <strong className="text-[#73aa57] font-semibold">never</strong> place personally identifiable
              information in Cookies.
            </HighlightBox>
          </SectionCard>

          {/* ── 13 Kids ── */}
          <SectionCard icon={<Baby size={16} color="#000" />} title="Children's Privacy" num="13" delay={0.65}>
            <BodyText>
              We do not address anyone under the age of 13. We do not knowingly collect personally identifiable
              information from anyone under the age of 13. If you are a parent or guardian and you are aware
              that your child has provided us with Personal Data, please contact us.
            </BodyText>
            <BodyText>
              If we become aware that we have collected Personal Data from anyone under the age of 13 without
              verification of parental consent, we take steps to remove that information from our servers.
            </BodyText>
          </SectionCard>

          {/* ── 14 Changes ── */}
          <SectionCard icon={<RefreshCw size={16} color="#000" />} title="Changes to This Policy" num="14" delay={0.7}>
            <BodyText>
              We may change our Service and policies, and we may need to make changes to this Privacy Policy so
              that they accurately reflect our Service and policies. Unless otherwise required by law, we will
              notify you before we make changes to this Privacy Policy and give you an opportunity to review
              them before they go into effect.
            </BodyText>
            <BodyText>
              If you continue to use the Service after changes take effect, you will be bound by the updated
              Privacy Policy. If you do not want to agree to this or any updated Privacy Policy, you can delete
              your account.
            </BodyText>
          </SectionCard>

          {/* ── Contact strip ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 mt-2 border border-[rgba(115,170,87,0.25)]"
            style={{ background: 'linear-gradient(135deg, rgba(115,170,87,0.12) 0%, rgba(91,143,82,0.06) 100%)' }}
          >
            <div>
              <h3 className="text-white font-bold text-lg mb-1 tracking-tight">
                Have questions about your privacy?
              </h3>
              <p className="text-sm text-white/55">Don't hesitate to reach out — we're here to help.</p>
            </div>
            <a
              href="mailto:support@corva.ca"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-black flex-shrink-0 transition-all duration-300 hover:scale-[1.03]"
              style={{
                background: 'linear-gradient(135deg, #73aa57 0%, #5b8f52 100%)',
                boxShadow: '0 6px 24px rgba(115,170,87,0.35)',
              }}
            >
              <Mail size={14} />
              Contact Us
            </a>
          </motion.div>

        </div>
      </main>

      <Footer />
    </>
  );
}