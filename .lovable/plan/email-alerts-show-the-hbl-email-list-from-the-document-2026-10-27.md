# Email Alerts: show the HBL email list from the document

## What changes for users
On the MRB create screens, the "Email Alert Recipients" box will always show the official emails from the document under each department, with a checkbox for each one:
- PURCHASE (7): anveshreddy.amaravadi, subbarao.parsepu, rajesh.padamata, upender.karra, guravaiah.maddigunta, manjula.patil, sudhakarrs
- ENGINEERING (3): prasad.jagatha, subrahmanyam.yadavalli, ravinderreddy
- PRODUCTION (8): leelarani.ravinuthala, kirankumar.gatla, rajanikanth.marepally, madhu.allam, jyothi.syamantha, vamshikrishna.komatireddy, thalari.penchal, durgaprasad.tata
- QUALITY CONTROL (7): kishore.jakku, anand.banoth, parasuramudu.kuruva, saleem.abdul, pratapkumar.nulakala, prudhvi.gujja, usreenivasu
- STORES (3): tmkmechstores, satyannarayana.singupuram, madhusudhana.kasula
(all @hbl.in)

These emails show even if the person does not have a login yet. Any users already in the app for that department still show too (no duplicates). Picked emails are saved and used for alerts exactly as today. If none are picked, alerts go out as they do today.

## What stays the same
Saving, email sending, templates, workflow and approvals stay the same.

## Technical details
- New file `src/lib/hblAlertContacts.ts` with the list, grouped by department.
- `AlertRecipientPicker.tsx`: match each workflow department to a list group using its role key and display name (purchase, engineering/design, production/shop_floor, quality/qc/process_qc/qc_hod, stores). Add the matching list emails to the people shown, skipping duplicates by email. Contacts with no login are saved with an empty user_id. They are told apart by email, so the checkbox toggle compares emails instead of user ids.
- Check `mrb_alert_recipients.user_id` allows empty values (the schema says it does). No database change is needed.
