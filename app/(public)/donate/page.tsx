import Image from "next/image";
import PageHero from "@/components/layout/PageHero";
import PayPalDonateButton from "@/components/donate/PayPalDonateButton";
import ZeffyDonationForm from "@/components/donate/ZeffyDonationForm";
import ChariotDafButton from "@/components/donate/ChariotDafButton";
import { siteConfig } from "@/lib/site-config";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata(
  "Donate",
  "Support a Montana nonprofit dog rescue. Your tax-deductible donation to Sky's Path to Home pays for veterinary care, medication, and foster support for rescued dogs.",
  "/donate/"
);

export default function DonatePage() {
  return (
    <>
      <PageHero title="Help Give a Dog a Safe Path Home" />

      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <h2 className="text-center font-heading text-2xl font-semibold text-brand-deep-blue">
          Your Donation Saves Lives
        </h2>
        <div className="mx-auto mt-4 max-w-2xl space-y-4 text-left text-base leading-relaxed text-brand-charcoal">
          <p>
            Every donation to Sky&rsquo;s Path to Home helps provide food, veterinary care,
            transportation, vaccinations, spaying and neutering, and other essential services for
            dogs in need.
          </p>
          <p>
            Many of the dogs we rescue come from overcrowded shelters in states such as Texas and
            California, where thousands of stray and surrendered animals enter shelters each year.
            When shelters exceed capacity, dogs may be placed on euthanasia lists because of their
            age, medical needs, or simply because there is no available space.
          </p>
          <p>
            We work with shelters, rescue organizations, foster families, adopters, and transport
            volunteers to move dogs out of these high-risk situations. Some dogs are transported
            directly to approved adopters in other states, while others are brought to Montana and
            placed in foster homes until they find safe, permanent, and loving families.
          </p>
          <p>
            Your support makes this work possible. Donations help us cover the costs associated
            with each rescue and allow us to continue responding when a dog urgently needs help.
          </p>
          <p>
            You may make a one-time contribution or become a monthly donor. Every gift, regardless
            of the amount, helps give a vulnerable dog a path to safety and a home. 100% of your
            donation goes directly toward our dogs and our mission.
          </p>
        </div>

        {/* Zeffy passes on 100% of a donation -- it charges nonprofits nothing
            and asks donors for an optional tip -- so it leads. The form needs
            the full column width; the two compact options pair up below it. */}
        <div className="mx-auto mt-12 max-w-xl rounded-lg border border-brand-soft-blue bg-brand-gray p-6 text-center">
          <h2 className="font-heading text-lg font-semibold text-brand-deep-blue">
            Give online
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-brand-charcoal/90">
            One-time or monthly, by card. 100% of your donation reaches the dogs.
          </p>
          <ZeffyDonationForm />
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="rounded-lg border border-brand-soft-blue bg-brand-gray p-6 text-center">
          <h2 className="font-heading text-lg font-semibold text-brand-deep-blue">
            Give with PayPal, Venmo, or a card
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-brand-charcoal/90">
            You don&rsquo;t need a PayPal account to give by card.
          </p>
          <div className="mt-4">
            <PayPalDonateButton />
          </div>
        </div>

        <div className="rounded-lg border border-brand-soft-blue bg-brand-gray p-6 text-center">
          <h2 className="font-heading text-lg font-semibold text-brand-deep-blue">
            Give via Zelle
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-brand-charcoal/90">
            Scan the QR code below in your banking app, or send to{" "}
            <span className="font-semibold">sky@skyspath.com</span> on Zelle.
          </p>
          <div className="relative mx-auto mt-4 aspect-[700/775] w-full max-w-[280px] overflow-hidden rounded-lg bg-white">
            <Image
              src="/donate/zelle-qr-code.png"
              alt="Zelle QR code to send a donation to Sky's Path to Home"
              fill
              className="object-contain"
            />
          </div>
        </div>

        </div>

        {/* One card for both: we have no brokerage account, so shares cannot
            come to us directly -- stock reaches us as a cash grant from the
            donor's own DAF, which matches the charity by name or EIN. The
            Chariot DAFpay button and the Givebutter link shortcut step 3 and
            appear once their ids are filled in; the steps work regardless. */}
        <div className="mx-auto mt-6 max-w-xl rounded-lg border border-brand-soft-blue bg-brand-gray p-6 text-left">
          <h2 className="text-center font-heading text-lg font-semibold text-brand-deep-blue">
            Give Stock or from a Donor-Advised Fund
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-brand-charcoal/90">
            Sky&rsquo;s Path to Home can&rsquo;t receive shares directly yet, but you can give
            appreciated stock through a donor-advised fund (DAF). It takes three steps. Already
            have a DAF with money in it? Go straight to step 3.
          </p>
          <ol className="mt-4 list-decimal space-y-4 pl-5 text-sm leading-relaxed text-brand-charcoal/90">
            <li>
              <span className="font-semibold text-brand-charcoal">
                Open a DAF, or use one you already have.
              </span>{" "}
              Most brokerages have their own: Fidelity Charitable (Fidelity), DAFgiving360
              (Schwab), Vanguard Charitable. Daffy and Charityvest also work with any brokerage.
              Opening one is usually free and done online.
            </li>
            <li>
              <span className="font-semibold text-brand-charcoal">
                Move the shares into your DAF.
              </span>{" "}
              In your DAF account, choose to contribute securities and follow the prompts to
              transfer the shares from your brokerage account. If the DAF is at the same firm as
              your brokerage, this is usually a few clicks. The DAF sells the shares, and your tax
              receipt for the stock gift comes from the DAF sponsor.
            </li>
            <li>
              <span className="font-semibold text-brand-charcoal">
                Recommend a grant to Sky&rsquo;s Path to Home.
              </span>{" "}
              Once the cash shows in your DAF (typically a few business days), choose
              &ldquo;recommend a grant&rdquo; and search for us by name or EIN:
              <dl className="mt-3 grid max-w-xs grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-brand-charcoal">
                <dt className="font-semibold">Legal name</dt>
                <dd>{siteConfig.legalName}</dd>
                <dt className="font-semibold">EIN</dt>
                <dd>{siteConfig.ein}</dd>
              </dl>
              <p className="mt-3">
                Enter the amount and submit. Please include your name on the grant (don&rsquo;t
                mark it anonymous) so we can thank you.
              </p>
            </li>
          </ol>
          {siteConfig.chariotConnectId ? (
            <div className="mt-5 text-center">
              <p className="text-sm leading-relaxed text-brand-charcoal/90">
                Or use DAFpay to recommend the grant in a few clicks, with no forms to fill out.
              </p>
              <div className="mt-3">
                <ChariotDafButton />
              </div>
            </div>
          ) : (
            siteConfig.givebutterDafUrl && (
              <div className="mt-5 text-center">
                <a
                  href={siteConfig.givebutterDafUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-full bg-brand-purple px-6 py-2.5 text-sm font-semibold text-brand-white shadow-sm transition-colors hover:bg-brand-deep-blue focus-visible:outline-brand-deep-blue"
                >
                  Give from your DAF in a few clicks
                </a>
              </div>
            )
          )}
          <p className="mt-5 text-sm leading-relaxed text-brand-charcoal/90">
            Please email us at{" "}
            <a href={`mailto:${siteConfig.contactEmail}`} className="font-semibold underline">
              {siteConfig.contactEmail}
            </a>{" "}
            the amount and the DAF you used, so we can watch for the grant and match it to you.
          </p>
          <p className="mt-3 text-center text-xs leading-relaxed text-brand-charcoal/70">
            We are a verified nonprofit with Chariot, so DAF grants reach us electronically.
          </p>
        </div>

        <div className="mx-auto mt-6 max-w-xl rounded-lg border border-brand-soft-blue bg-brand-gray p-6 text-left">
          <h2 className="font-heading text-lg font-semibold text-brand-deep-blue">
            Our Nonprofit Status
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-brand-charcoal/90">
            {siteConfig.nonprofitStatus}
          </p>
        </div>
      </section>
    </>
  );
}
