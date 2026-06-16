import { database as invoiceDb } from "@/plugins/fake-api/handlers/apps/invoice/db";
import { database as proformaDb } from "@/plugins/fake-api/handlers/apps/proforma/db";
import { database as quotationDb } from "@/plugins/fake-api/handlers/apps/quotation/db";
import { db as contactsDb } from "@/plugins/fake-api/handlers/apps/contact/db";
import { db as employeesDb } from "@/plugins/fake-api/handlers/apps/employees/db";
import { db as dealsDb } from "@/plugins/fake-api/handlers/operations/deals/db";
import { db as jobsDb } from "@/plugins/fake-api/handlers/operations/jobs/db";
import { seedAccountRoleState } from "@/utils/accountRoles";

const hasValue = (value: unknown) =>
  value !== undefined && value !== null && String(value).trim() !== "";

const asId = (value: unknown) => String(value ?? "").trim();

const employeeIds = () =>
  new Set(employeesDb.users.map((employee) => asId(employee.id)));

const contactIds = () =>
  new Set(contactsDb.users.map((contact) => asId(contact.id)));

const dealIds = () => new Set(dealsDb.deals.map((deal) => asId(deal.id)));

const assert = (condition: boolean, message: string, errors: string[]) => {
  if (!condition) errors.push(message);
};

export const validateSeedIntegrity = () => {
  const errors: string[] = [];
  const employees = employeeIds();
  const contacts = contactIds();
  const deals = dealIds();
  const accountState = seedAccountRoleState();

  accountState.users.forEach((user) => {
    assert(hasValue(user.employeeId), `User ${user.email} has no employeeId.`, errors);
    assert(hasValue(user.personId), `User ${user.email} has no personId.`, errors);
    assert(
      employees.has(asId(user.employeeId)),
      `User ${user.email} links missing employee ${user.employeeId}.`,
      errors,
    );
  });

  employeesDb.users.forEach((employee) => {
    const employment = employee.employment as any;
    assert(!("managerId" in (employment ?? {})), `Employee ${employee.id} uses managerId.`, errors);
    assert(!("reportToId" in (employment ?? {})), `Employee ${employee.id} uses reportToId.`, errors);
    (employee.employment?.reportToIds ?? []).forEach((managerId) =>
      assert(
        employees.has(asId(managerId)),
        `Employee ${employee.id} reports to missing employee ${managerId}.`,
        errors,
      ),
    );
  });

  dealsDb.deals.forEach((deal) => {
    assert(contacts.has(asId(deal.relatedTo)), `Deal ${deal.id} has invalid related contact.`, errors);
    assert(employees.has(asId(deal.salesman)), `Deal ${deal.id} has invalid salesman.`, errors);
    deal.collaborators.forEach((collaboratorId) =>
      assert(
        employees.has(asId(collaboratorId)),
        `Deal ${deal.id} has invalid collaborator ${collaboratorId}.`,
        errors,
      ),
    );
  });

  jobsDb.jobs.forEach((job) => {
    assert(contacts.has(asId(job.relatedTo)), `Job ${job.id} has invalid related contact.`, errors);
    job.collaborators.forEach((collaboratorId) =>
      assert(
        employees.has(asId(collaboratorId)),
        `Job ${job.id} has invalid collaborator ${collaboratorId}.`,
        errors,
      ),
    );
    job.stakeholders.forEach((stakeholder) =>
      assert(
        contacts.has(asId(stakeholder.contactId)),
        `Job ${job.id} has invalid stakeholder contact ${stakeholder.contactId}.`,
        errors,
      ),
    );
  });

  quotationDb.forEach((record) => {
    assert(deals.has(asId(record.quotation.dealId)), `Quotation ${record.quotation.id} has invalid deal link.`, errors);
  });
  proformaDb.forEach((record) => {
    assert(deals.has(asId(record.quotation.dealId)), `Proforma ${record.quotation.id} has invalid deal link.`, errors);
  });
  invoiceDb.forEach((record) => {
    assert(deals.has(asId(record.quotation.dealId)), `Invoice ${record.quotation.id} has invalid deal link.`, errors);
  });

  return errors;
};

export const assertSeedIntegrity = () => {
  const errors = validateSeedIntegrity();
  if (errors.length) throw new Error(`Seed integrity failed:\n${errors.join("\n")}`);
};
