import java.util.*;

class Normal extends ArrayList {

}

// Signature:"<T1:Ljava/lang/Object;
//   T2:Ljava/lang/String;
//   T3::Ljava/lang/Comparable<TT2;>;
//   T4::Ljava/lang/Comparable<Ljava/lang/Enum;>;:Ljava/util/List;
//   T5::Ljava/util/List;:Ljava/lang/Comparable<Ljava/lang/Enum;>;
// >Ljava/util/ArrayList;"

class TypeVars<T1, 
    T2 extends String,
    T3 extends Comparable<T2>,
    T4 extends Comparable<Enum> & List,
    T5 extends List & Comparable<Enum>
    > extends ArrayList {

}