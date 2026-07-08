# Guide utilisateur — GeoColleges Douala IV

## 1. Consultation (visiteur / compte "consultation")
- **Accueil** : vue d'ensemble et KPIs globaux.
- **Carte** : recherchez un établissement par nom, quartier ou filière ; filtrez par
  statut, section, bus, cantine, sport ; cliquez un marqueur pour voir les détails ;
  utilisez "Me géolocaliser" pour vous situer sur la carte.
- **Statistiques** : tableau de bord avec répartitions par quartier, statut, section, cycle.
- **Fiche établissement** : cliquez "Fiche complète" depuis une popup ou la liste latérale.

## 2. Gestionnaire
En plus de la consultation : création/modification des fiches établissements depuis
`/admin`, import de fichiers CSV.

## 3. Administrateur
Accès complet : gestion des utilisateurs (création, activation/désactivation,
suppression, changement de rôle), consultation du journal d'activité, CRUD complet
sur les établissements, import CSV.

## 4. Recherche en langage naturel
Le champ de recherche accepte des requêtes formulées en langage naturel, par exemple :
« je cherche un lycée public avec bus à Sodiko ». Si une clé Claude API est configurée
côté serveur, l'interprétation est plus fine ; sinon un moteur de règles local prend
automatiquement le relais.
