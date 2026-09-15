/* =====================================================================
   ASGAARD — interactions front-end
   Menu mobile, scroll header, reveal animations, FAQ, modales d'abonnement.

   Architecture "vente en ligne" (à connecter plus tard) :
   - Chaque bouton d'offre porte data-plan / data-plan-name / data-plan-price.
   - Le formulaire #subscribe-form est prêt à être branché sur un vrai
     backend (ex: fetch('/api/subscribe', { method: 'POST', body }))
     et/ou une solution de paiement (ex: Stripe Checkout / Payment Links).
   - Aucun paiement n'est simulé : la confirmation affichée porte
     uniquement sur l'envoi de la demande, pas sur un paiement réalisé.
===================================================================== */

document.addEventListener("DOMContentLoaded", function () {
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- Header : fond au scroll ---------------- */
  var header = document.getElementById("site-header");
  function onScrollHeader() {
    if (window.scrollY > 40) {
      header.classList.add("is-scrolled");
    } else {
      header.classList.remove("is-scrolled");
    }
  }
  onScrollHeader();
  window.addEventListener("scroll", onScrollHeader, { passive: true });

  /* ---------------- Menu mobile ---------------- */
  var navToggle = document.getElementById("nav-toggle");
  var mainNav = document.getElementById("main-nav");

  function closeNav() {
    mainNav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "Ouvrir le menu");
  }

  function toggleNav() {
    var isOpen = mainNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    navToggle.setAttribute("aria-label", isOpen ? "Fermer le menu" : "Ouvrir le menu");
  }

  navToggle.addEventListener("click", toggleNav);

  mainNav.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", closeNav);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeNav();
  });

  /* ---------------- Navigation active au scroll ---------------- */
  var navLinks = Array.prototype.slice.call(mainNav.querySelectorAll("a[href^='#']"));
  var sections = navLinks
    .map(function (link) { return document.querySelector(link.getAttribute("href")); })
    .filter(Boolean);

  if ("IntersectionObserver" in window && sections.length) {
    var navObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var id = "#" + entry.target.id;
          navLinks.forEach(function (link) {
            link.classList.toggle("is-active", link.getAttribute("href") === id);
          });
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sections.forEach(function (s) { navObserver.observe(s); });
  }

  /* ---------------- Reveal on scroll ---------------- */
  var revealEls = document.querySelectorAll("[data-reveal]");
  if (reducedMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  } else {
    var revealObserver = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealEls.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ---------------- FAQ accordion ---------------- */
  document.querySelectorAll(".faq-item").forEach(function (item) {
    var q = item.querySelector(".faq-q");
    var a = item.querySelector(".faq-a");

    q.addEventListener("click", function () {
      var isOpen = item.getAttribute("data-open") === "true";

      document.querySelectorAll(".faq-item").forEach(function (other) {
        if (other !== item) {
          other.setAttribute("data-open", "false");
          other.querySelector(".faq-q").setAttribute("aria-expanded", "false");
          other.querySelector(".faq-a").style.maxHeight = null;
        }
      });

      if (isOpen) {
        item.setAttribute("data-open", "false");
        q.setAttribute("aria-expanded", "false");
        a.style.maxHeight = null;
      } else {
        item.setAttribute("data-open", "true");
        q.setAttribute("aria-expanded", "true");
        a.style.maxHeight = a.scrollHeight + "px";
      }
    });
  });

  /* ---------------- Modales génériques ---------------- */
  function openModal(modal) {
    modal.classList.add("is-open");
    document.body.style.overflow = "hidden";
    var focusable = modal.querySelector("input, button, textarea, select");
    if (focusable) focusable.focus();
  }

  function closeModal(modal) {
    modal.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  document.querySelectorAll(".modal-overlay").forEach(function (overlay) {
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeModal(overlay);
    });
  });

  document.querySelectorAll("[data-close-modal]").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      var modal = btn.closest(".modal-overlay");
      if (modal) {
        e.preventDefault();
        closeModal(modal);
      }
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    document.querySelectorAll(".modal-overlay.is-open").forEach(closeModal);
  });

  /* ---------------- Modale abonnement ---------------- */
  var subscribeModal = document.getElementById("modal-subscribe");
  var subscribeBody = document.getElementById("modal-subscribe-body");
  var subscribeSuccess = document.getElementById("modal-success");
  var subscribeForm = document.getElementById("subscribe-form");
  var modalPlanName = document.getElementById("modal-plan-name");
  var modalPlanPrice = document.getElementById("modal-plan-price");
  var duoPartnerField = document.getElementById("duo-partner-field");
  var currentPlanLabel = "";

  document.querySelectorAll("[data-open-modal]").forEach(function (trigger) {
    trigger.addEventListener("click", function (e) {
      e.preventDefault();
      var plan = trigger.getAttribute("data-plan");
      var planName = trigger.getAttribute("data-plan-name") || "Abonnement";
      var planPrice = trigger.getAttribute("data-plan-price") || "";
      var planPeriod = trigger.getAttribute("data-plan-period") || "";

      currentPlanLabel = planName;
      modalPlanName.textContent = planName;
      modalPlanPrice.textContent = planPrice + " " + planPeriod;
      duoPartnerField.style.display = plan === "duo" ? "grid" : "none";

      subscribeBody.hidden = false;
      subscribeSuccess.hidden = true;
      subscribeForm.reset();

      openModal(subscribeModal);
    });
  });

  if (subscribeForm) {
    subscribeForm.addEventListener("submit", function (e) {
      e.preventDefault();

      var payload = {
        plan: currentPlanLabel,
        firstname: document.getElementById("s-firstname").value,
        lastname: document.getElementById("s-lastname").value,
        email: document.getElementById("s-email").value,
        phone: document.getElementById("s-phone").value,
        partner: document.getElementById("s-partner").value
      };

      /* TODO (intégration future) :
         fetch("/api/subscribe", {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify(payload)
         });
         Puis redirection vers un prestataire de paiement (ex: Stripe Checkout)
         pour le paiement par carte et la mise en place du prélèvement
         mensuel récurrent (Mensuel / Duo) ou du paiement unique (Pass Day). */
      console.log("Demande d'abonnement ASGAARD :", payload);

      document.getElementById("success-name").textContent = payload.firstname || "";
      document.getElementById("success-plan").textContent = currentPlanLabel;

      subscribeBody.hidden = true;
      subscribeSuccess.hidden = false;
    });
  }

  /* ---------------- Modale espace membre ---------------- */
  var accountModal = document.getElementById("modal-account");
  ["open-account", "footer-account"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        openModal(accountModal);
      });
    }
  });

  /* ---------------- Formulaire de contact ---------------- */
  var contactForm = document.getElementById("contact-form");
  if (contactForm) {
    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();
      /* TODO (intégration future) : envoyer vers un backend / service d'emailing. */
      var btn = contactForm.querySelector("button[type=submit]");
      var original = btn.textContent;
      btn.textContent = "Message envoyé !";
      contactForm.reset();
      setTimeout(function () { btn.textContent = original; }, 3000);
    });
  }

  /* ---------------- Année footer ---------------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});
