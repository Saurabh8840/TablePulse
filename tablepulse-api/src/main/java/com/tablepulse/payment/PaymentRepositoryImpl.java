package com.tablepulse.payment;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class PaymentRepositoryImpl implements PaymentRepositoryCustom {

    @PersistenceContext
    private EntityManager em;

    @Override
    public List<Payment> search(UUID tenantId, UUID branchId, Instant from, Instant to) {
        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<Payment> cq = cb.createQuery(Payment.class);
        Root<Payment> p = cq.from(Payment.class);
        List<Predicate> predicates = new ArrayList<>();
        predicates.add(cb.equal(p.get("tenant").get("id"), tenantId));
        if (branchId != null) {
            predicates.add(cb.equal(p.get("branch").get("id"), branchId));
        }
        if (from != null) {
            predicates.add(cb.greaterThanOrEqualTo(p.get("createdAt"), from));
        }
        if (to != null) {
            predicates.add(cb.lessThan(p.get("createdAt"), to));
        }
        cq.where(predicates.toArray(new Predicate[0]));
        cq.orderBy(cb.desc(p.get("createdAt")));
        return em.createQuery(cq).getResultList();
    }
}
