import json, re
def slug(s): return re.sub(r'[^a-z0-9]+','-',s.lower()).strip('-')
M = [
("Number bases and modular arithmetic",["Operations in number bases","Conversion between bases","Modular arithmetic"]),
("Fractions, decimals, approximations and percentages",["Fractions and decimals","Significant figures and decimal places","Percentage errors","Simple interest","Profit and loss percent","Ratio, proportion and rate","Shares and VAT"]),
("Indices, logarithms and surds",["Laws of indices","Equations involving indices","Standard form","Logarithms","Surds"]),
("Sets",["Types of sets","Algebra of sets","Venn diagrams"]),
("Polynomials and equations",["Change of subject of formula","Operations on polynomials","Factorization","Roots of polynomials","Factor and remainder theorems","Simultaneous equations","Graphs of polynomials"]),
("Variation",["Direct and inverse variation","Joint and partial variation","Percentage increase and decrease"]),
("Inequalities",["Linear inequalities","Quadratic inequalities","Graphs of inequalities"]),
("Progression",["nth term of a progression","Sum of A.P. and G.P.","Sum to infinity of a G.P."]),
("Binary operations",["Closure, commutativity, associativity and distributivity","Identity and inverse elements"]),
("Matrices and determinants",["Algebra of matrices","Determinants","Inverses of 2 x 2 matrices"]),
("Euclidean geometry",["Angles and lines","Polygons","Circles","Construction"]),
("Mensuration",["Plane figures","Arcs and chords","Sectors and segments","Surface areas and volumes of solids","The earth as a sphere"]),
("Loci",["Loci in two dimensions"]),
("Coordinate geometry",["Midpoint and gradient","Distance between two points","Parallel and perpendicular lines","Equations of straight lines"]),
("Trigonometry",["Trigonometrical ratios","Angles of elevation and depression","Bearings","Areas and solutions of triangles","Graphs of sine and cosine","Sine and cosine formulae"]),
("Differentiation",["Limit of a function","Differentiation of functions"]),
("Application of differentiation",["Rate of change","Maxima and minima"]),
("Integration",["Integration of functions","Area under the curve"]),
("Representation of data",["Frequency distribution","Histogram, bar chart and pie chart"]),
("Measures of location",["Mean, mode and median","Cumulative frequency"]),
("Measures of dispersion",["Range and mean deviation","Variance and standard deviation"]),
("Permutation and combination",["Linear and circular arrangements","Arrangements with repeated objects"]),
("Probability",["Experimental probability","Addition and multiplication of probabilities"]),
]
C = [
("Commerce",["E-commerce and e-business","Meaning and scope","Characteristics","Functions"]),
("Occupation",["Meaning and importance","Types of occupation","Choice of occupation"]),
("Production",["Factors of production and rewards","Division of labour and specialization","Types of production","Production, specialization and exchange"]),
("Trade",["Retail trade","Wholesale trade","Foreign trade"]),
("Purchase and sale of goods",["Procedure and documentation","Terms of trade","Terms of payment","Means of payment"]),
("Aids to trade",["Advertising","Banking","Communication","Insurance","Tourism","Transportation","Warehousing"]),
("Business units",["Forms and features","Registration of businesses","Choice of business unit","Dissolution and liquidation","Public enterprises"]),
("Financing business",["Sources of finance","Types of capital","Capital, profit and turnover","Problems of sourcing finance","Bureau de change"]),
("Trade associations",["Trade and manufacturers' associations","Chambers of commerce","Business combination and merger"]),
("Money",["Evolution of money","Forms and qualities","Functions of money"]),
("Stock exchange",["Importance and functions","Types of securities","Transactions and speculation","Second-tier securities market"]),
("Elements of business management",["Functions of management","Principles of management","Organizational structure","Functional areas of business","Business resources"]),
("Elements of marketing",["Importance and functions","Marketing concept","Marketing mix","Market segmentation","Public relations and customer service","E-marketing"]),
("Legal aspects of business",["Simple contract","Agency, Sale of Goods and Hire Purchase","Contract of employment","Government regulation of business","Consumer protection","Regulatory agencies"]),
("Commodity exchange",["Meaning and types of commodity","Requirements for trading","Methods of trading","Benefits and constraints"]),
("Business environment and social responsibility",["Types of business environment","Social responsibility and safe products","Pollution"]),
]
q=lambda s:s.replace("'","''")
out=["-- JAMB Mathematics and Commerce topics and subtopics, from the official UTME syllabi.","-- Topic order follows the syllabus. Neither subject had any topics before this.",""]
data={}
for sid,L in (("mathematics",M),("commerce",C)):
    data[sid]=[{"name":n,"subtopics":s} for n,s in L]
    for i,(n,subs) in enumerate(L,1):
        out.append(f"insert into public.topics (subject_id, slug, name, sort_order) values ('{sid}', '{slug(n)}', '{q(n)}', {i}) on conflict (subject_id, slug) do nothing;")
        for j,s in enumerate(subs,1):
            out.append(f"insert into public.subtopics (topic_id, slug, name, sort_order) select id, '{slug(s)}', '{q(s)}', {j} from public.topics where subject_id='{sid}' and slug='{slug(n)}' on conflict (topic_id, slug) do nothing;")
open('supabase/migrations/20261111000004_maths_commerce_topics.sql','w',encoding='utf8').write("\n".join(out)+"\n")
json.dump(data,open('data/taxonomy/maths-commerce.json','w',encoding='utf8'),indent=1,ensure_ascii=False)
print(len(M),len(C))
