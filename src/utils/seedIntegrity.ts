import { database as invoiceDb } from "@/plugins/fake-api/handlers/apps/invoice/db";
import { database as proformaDb } from "@/plugins/fake-api/handlers/apps/proforma/db";
import { database as quotationDb } from "@/plugins/fake-api/handlers/apps/quotation/db";
import { db as contactsDb } from "@/plugins/fake-api/handlers/apps/contact/db";
import { db as employeesDb } from "@/plugins/fake-api/handlers/apps/employees/db";
import { db as dealsDb } from "@/plugins/fake-api/handlers/operations/deals/db";
import { db as jobsDb } from "@/plugins/fake-api/handlers/operations/jobs/db";
import { SeedTodos } from "@/data/seed-todos";
import { seedAccountRoleState } from "@/utils/accountRoles";

const hasValue = (value: unknown) =>
  value !== undefined && value !== null && String(value).trim() !== "";

const asId = (value: unknown) => String(value ?? "").trim();

const employeeIds = () =>
  new Set(employeesDb.users.map((employee) => asId(employee.id)));

const contactIds = () =>
  new Set(contactsDb.users.map((contact) => asId(contact.id)));

const dealIds = () => new Set(dealsDb.deals.map((deal) => asId(deal.id)));

const jobIds = () => new Set(jobsDb.jobs.map((job) => asId(job.id)));

const assert = (condition: boolean, message: string, errors: string[]) => {
  if (!condition) errors.push(message);
};

export const validateSeedIntegrity = () => {
  const errors: string[] = [];
  const employees = employeeIds();
  const contacts = contactIds();
  const deals = dealIds();
  const jobs = jobIds();
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

  const todosByJobId = new Map<string, typeof SeedTodos>();

  SeedTodos.forEach((todo) => {
    const relatedTo = (todo as any).relatedTo;
    const relatedType = relatedTo?.type;
    const relatedId = asId(relatedTo?.id);

    assert(
      relatedType === "deal" || relatedType === "job",
      `Todo ${todo.id} is not linked to a module record.`,
      errors,
    );

    if (relatedType === "deal") {
      assert(deals.has(relatedId), `Todo ${todo.id} links missing deal ${relatedId}.`, errors);
    }

    if (relatedType === "job") {
      const job = jobsDb.jobs.find((item) => asId(item.id) === relatedId);
      assert(jobs.has(relatedId), `Todo ${todo.id} links missing job ${relatedId}.`, errors);
      assert(hasValue((todo as any).startAt), `Project todo ${todo.id} has no startAt.`, errors);
      assert(hasValue(todo.dueAt), `Project todo ${todo.id} has no dueAt.`, errors);
      assert(
        Number((todo as any).completionMinutes ?? 0) > 0,
        `Project todo ${todo.id} has no completionMinutes.`,
        errors,
      );

      if (job) {
        if (hasValue((todo as any).milestoneId)) {
          assert(
            job.milestones.some((milestone) => asId(milestone.id) === asId((todo as any).milestoneId)),
            `Project todo ${todo.id} links missing milestone ${(todo as any).milestoneId}.`,
            errors,
          );
        }
        if (hasValue((todo as any).goalId)) {
          assert(
            job.goals.some((goal) => asId(goal.id) === asId((todo as any).goalId)),
            `Project todo ${todo.id} links missing goal ${(todo as any).goalId}.`,
            errors,
          );
        }
      }

      const list = todosByJobId.get(relatedId) ?? [];
      list.push(todo);
      todosByJobId.set(relatedId, list);
    }

    [...(todo.messages ?? []), ...(todo.activities ?? [])].forEach((entry) => {
      const author = (entry as any).author;
      assert(asId(author?.id) !== "me", `Todo ${todo.id} uses placeholder author id me.`, errors);
      assert(asId(author?.name) !== "You", `Todo ${todo.id} uses placeholder author name You.`, errors);
    });
  });

  jobsDb.jobs.forEach((job) => {
    if (job.status === "Closed") return;

    const jobTodos = todosByJobId.get(asId(job.id)) ?? [];
    const hasActive = jobTodos.some((todo) => todo.status === "in_progress");
    const hasCompleted = jobTodos.some((todo) => todo.status === "completed");
    const hasOpen = jobTodos.some((todo) => todo.status !== "completed");
    const allCompleted = jobTodos.length > 0 && jobTodos.every((todo) => todo.status === "completed");

    if (job.status === "In Progress") {
      assert(hasActive, `Job ${job.id} is In Progress without an active project task.`, errors);
    }
    if (job.status === "Pending") {
      assert(!hasActive && !hasCompleted && hasOpen, `Job ${job.id} is Pending but task state is not prepared-only.`, errors);
    }
    if (job.status === "On Hold") {
      assert(hasCompleted && hasOpen && !hasActive, `Job ${job.id} is On Hold but task state is not completed-plus-pending.`, errors);
    }
    if (job.status === "Completed") {
      assert(allCompleted, `Job ${job.id} is Completed but project tasks are not all completed.`, errors);
    }
    if (job.status === "New") {
      assert(!hasActive && !hasCompleted, `Job ${job.id} is New but project work has started.`, errors);
    }
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
