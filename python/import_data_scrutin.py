import numpy as np
import pandas as pd
import json
import zipfile
import requests, io


url = 'http://data.assemblee-nationale.fr/static/openData/repository/LOI/scrutins/Scrutins_XIV.json.zip'
filename = url.split('/')[-1].replace('.zip', '')
repository = 'data_scrutin'
r = requests.get(url)

with zipfile.ZipFile(io.BytesIO(r.content)) as zip_ref:
    zip_ref.extractall(repository)

with open(repository + '/' + filename, 'r') as f:
    json_data = json.load(f)

df = pd.io.json.json_normalize(json_data['scrutins']['scrutin'])

def map_all_votes(all_votes):
    dict_votes = {'pours':[], 'contres':[], 'nonVotants':[], 'abstentions':[]}
    for parl_group in all_votes:
        decompte_nominatif = parl_group['vote']['decompteNominatif']
        for voteposition in decompte_nominatif.keys():
            try:
                dict_votes[voteposition] += [vote['acteurRef'] for vote in decompte_nominatif[voteposition]['votant']]
            except:
                dict_votes[voteposition] += []
    return [dict_votes['pours'], dict_votes['contres'], dict_votes['nonVotants'], dict_votes['abstentions'] ]


df_sel = df[['dateScrutin', 'demandeur.texte',
       'miseAuPoint.abstentions.votant',
       'miseAuPoint.abstentions.votant.acteurRef',
       'miseAuPoint.abstentions.votant.mandatRef',
       'miseAuPoint.contres.votant', 'miseAuPoint.contres.votant.acteurRef',
       'miseAuPoint.contres.votant.mandatRef',
       'miseAuPoint.nonVotantsVolontaires.votant',
       'miseAuPoint.pours.votant', 'miseAuPoint.pours.votant.acteurRef',
       'miseAuPoint.pours.votant.mandatRef', 'modePublicationDesVotes',
       'numero', 'objet.libelle',
       'quantiemeJourSeance', 'seanceRef', 'sessionRef', 'sort.code',
       'sort.libelle', 'syntheseVote.annonce',
       'syntheseVote.decompte.abstention', 'syntheseVote.decompte.contre',
       'syntheseVote.decompte.nonVotant', 'syntheseVote.decompte.pour',
       'syntheseVote.nbrSuffragesRequis', 'syntheseVote.nombreVotants',
       'syntheseVote.suffragesExprimes', 'titre', 'typeVote.codeTypeVote',
       'typeVote.libelleTypeVote', 'typeVote.typeMajorite', 'uid',
       'ventilationVotes.organe.groupes.groupe']]


df_sel.loc[:,'votes_pour'], df_sel.loc[:,'votes_contre'], df_sel.loc[:,'nonVotants'], df_sel.loc[:,'abstentions'] = zip(*df_sel['ventilationVotes.organe.groupes.groupe'].map(map_all_votes))



df_sel = df_sel.rename(columns={'demandeur.texte':'demandeur', 'sort.code': 'resultat','syntheseVote.decompte.abstention': 'nombre_abstentions',
                            'syntheseVote.decompte.pour': 'nombre_pour',
                            'syntheseVote.decompte.contre': 'nombre_contre',
                            'syntheseVote.decompte.nonVotant': 'nombre_nonVotant',
                            'syntheseVote.nbrSuffragesRequis': 'nombre_suffrages_requis',
                            'syntheseVote.nombreVotants': 'nombre_votants',
                            'syntheseVote.suffragesExprimes': 'nombre_suffrages_exprimes',
                            'typeVote.libelleTypeVote': 'type_vote',
                            'typeVote.typeMajorite': 'type_majorite',
                                   'objet.libelle':'libelle'})


typevote_dict = {"votes_pour":"Pour", "votes_contre":"Contre", "nonVotants":"Non-votant", "abstentions":"Abstention"}



def populate_summary_col(row):
    new_dict = {}
    for keyvote, valuevote in typevote_dict.items():
        for vote in row[keyvote]:
            new_dict[vote] = valuevote
    return new_dict



df_sel.loc[:,'all_votes'] = df_sel.apply(populate_summary_col, axis=1)

dict_col_keys = {'Abstention': 'miseAuPoint.abstentions.votant',
 'Non-votant': 'miseAuPoint.nonVotantsVolontaires.votant',
 'Contre': 'miseAuPoint.contres.votant',
 'Pour': 'miseAuPoint.pours.votant'}

def populate_votes_correction(row):
    temp_dict = {}
    for key, value in row.all_votes.items():
        if key in [x['acteurRef'] for x in row['miseAuPoint.abstentions.votant']]:
            temp_dict[key] = 'Abstention'
        elif key in [x['acteurRef'] for x in row['miseAuPoint.nonVotantsVolontaires.votant']]:
            temp_dict[key] = 'Non-votant'
        elif key in [x['acteurRef'] for x in row['miseAuPoint.contres.votant']]:
            temp_dict[key] = 'Contre'
        elif key in [x['acteurRef'] for x in row['miseAuPoint.pours.votant']]:
            temp_dict[key] = 'Pour'
        else:
            temp_dict[key] = value
    for key, value in dict_col_keys.items():
        for vote in [x['acteurRef'] for x in row[value]]:
            if vote not in temp_dict.keys():
                temp_dict[vote] = key
    return temp_dict

df_sel.loc[:,'all_votes_corr'] = df_sel.fillna('').apply(populate_votes_correction, axis=1)


df_sel = df_sel[['dateScrutin', 'demandeur', 'modePublicationDesVotes', 'numero',
       'libelle', 'quantiemeJourSeance', 'resultat', 'nombre_abstentions',
       'nombre_contre', 'nombre_nonVotant', 'nombre_pour',
       'nombre_suffrages_requis', 'nombre_votants',
       'nombre_suffrages_exprimes', 'titre', 'type_vote', 'type_majorite',
       'all_votes']]

df_sel.loc[:,'all_votes'] = df_sel.all_votes.astype('str').map(lambda x: x.replace("'", '"'))

df_sel.to_csv('../data/scrutins_tabular.csv')
