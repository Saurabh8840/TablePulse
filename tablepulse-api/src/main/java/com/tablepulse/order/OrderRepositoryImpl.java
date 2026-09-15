package com.tablepulse.order;

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

public class OrderRepositoryImpl implements OrderRepositoryCustom {

    @PersistenceContext
    private EntityManager em;

    @Override
    public List<Order> search(UUID tenantId, UUID branchId, OrderStatus status, Instant from, Instant to) {
        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<Order> cq = cb.createQuery(Order.class);
        Root<Order> o = cq.from(Order.class);
        List<Predicate> predicates = new ArrayList<>();
        predicates.add(cb.equal(o.get("tenant").get("id"), tenantId));
        if (branchId != null) {
            predicates.add(cb.equal(o.get("branch").get("id"), branchId));
        }
        if (status != null) {
            predicates.add(cb.equal(o.get("status"), status));
        }
        if (from != null) {
            predicates.add(cb.greaterThanOrEqualTo(o.get("placedAt"), from));
        }
        if (to != null) {
            predicates.add(cb.lessThan(o.get("placedAt"), to));
        }
        cq.where(predicates.toArray(new Predicate[0]));
        cq.orderBy(cb.desc(o.get("placedAt")));
        return em.createQuery(cq).getResultList();
    }
}
