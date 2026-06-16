import { paginateArray } from "@api-utils/paginateArray";
import { database } from "@db/apps/quotation/db";
import is from "@sindresorhus/is";
import { destr } from "destr";
import type { PathParams } from "msw";
import { HttpResponse, http } from "msw";
import {
  filterReadableResources,
  mapAuthorizationResource,
  permissionDeniedResponse,
  requireCurrentUserPermission,
} from "@/utils/authorization";

export const handlerAppsQuotation = [
  http.get("/api/apps/quotation/clients", () => {
    const clients = filterReadableResources("finance", database).map(
      (record) => record.quotation.client,
    );
    return HttpResponse.json(clients.slice(0, 5), { status: 200 });
  }),

  http.get("/api/apps/quotation", ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q");
    const status = url.searchParams.get("status");
    const page = url.searchParams.get("page");
    const itemsPerPage = url.searchParams.get("itemsPerPage");
    const sortBy = url.searchParams.get("sortBy");
    const orderBy = url.searchParams.get("orderBy");

    const queryLowered = (is.string(q) ? q : "").toLowerCase();
    const parsedSortBy = destr(sortBy);
    const parsedOrderBy = destr(orderBy);
    const parsedItemsPerPage = destr(itemsPerPage);
    const parsedPage = destr(page);

    const sortByLocal = is.string(parsedSortBy) ? parsedSortBy : "";
    const orderByLocal = is.string(parsedOrderBy) ? parsedOrderBy : "";
    const itemsPerPageLocal = is.number(parsedItemsPerPage)
      ? parsedItemsPerPage
      : 10;
    const pageLocal = is.number(parsedPage) ? parsedPage : 1;

    let filteredRecords = database.filter((record) => {
      const quotation = record.quotation;
      const matchesQuery =
        !queryLowered ||
        quotation.client.name.toLowerCase().includes(queryLowered) ||
        quotation.client.companyEmail.toLowerCase().includes(queryLowered) ||
        quotation.quoteNumber.toLowerCase().includes(queryLowered) ||
        String(quotation.id).includes(queryLowered);
      const matchesStatus = !status || quotation.quotationStatus === status;

      return matchesQuery && matchesStatus;
    });

    if (sortByLocal) {
      filteredRecords = [...filteredRecords].sort((a, b) => {
        const quotationA = a.quotation;
        const quotationB = b.quotation;

        if (sortByLocal === "client") {
          return orderByLocal === "asc"
            ? quotationA.client.name.localeCompare(quotationB.client.name)
            : quotationB.client.name.localeCompare(quotationA.client.name);
        }

        if (sortByLocal === "total") {
          return orderByLocal === "asc"
            ? quotationA.total - quotationB.total
            : quotationB.total - quotationA.total;
        }

        if (sortByLocal === "id") {
          return orderByLocal === "asc"
            ? quotationA.id - quotationB.id
            : quotationB.id - quotationA.id;
        }

        if (sortByLocal === "date") {
          return orderByLocal === "asc"
            ? new Date(quotationA.issuedDate).getTime() -
                new Date(quotationB.issuedDate).getTime()
            : new Date(quotationB.issuedDate).getTime() -
                new Date(quotationA.issuedDate).getTime();
        }

        return 0;
      });
    }

    filteredRecords = filterReadableResources("finance", filteredRecords);

    return HttpResponse.json(
      {
        quotations: paginateArray(filteredRecords, itemsPerPageLocal, pageLocal),
        totalQuotations: filteredRecords.length,
      },
      { status: 200 },
    );
  }),

  http.get<PathParams>("/api/apps/quotation/:id", ({ params }) => {
    const record =
      filterReadableResources("finance", database).find(
        (entry) => entry.quotation.id === Number(params.id),
      ) ?? null;

    if (!record) {
      return HttpResponse.json("No quotation found with this id", {
        status: 404,
      });
    }

    return HttpResponse.json(record, { status: 200 });
  }),

  http.delete("/api/apps/quotation/:id", ({ params }) => {
    const index = database.findIndex(
      (entry) => entry.quotation.id === Number(params.id),
    );

    if (index >= 0) {
      try {
        requireCurrentUserPermission(
          "finance",
          "delete",
          mapAuthorizationResource("finance", database[index]),
        );
      } catch {
        return permissionDeniedResponse("finance", "delete");
      }
      database.splice(index, 1);
      return new HttpResponse(null, { status: 204 });
    }

    return HttpResponse.json({ error: "Something went wrong" }, { status: 404 });
  }),
];
